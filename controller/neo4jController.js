const driver = require('../config/connectToDb').driver;
const session =driver.session();

const axios = require('axios');

const normalizeLink = require('../utils/utilFunctions').normalizeLink;

const sendEmail = require('../Jobs/automateMail');
const { getRank } = require('../utils/utilFunctions');
//API to add a new user with 4 required fields
const addUser = async (req, res) => {
    let { name, codeforcesHandle, githubHandle, team } = req.body;

    try {
        team=!team?"Global":team;
        // Check if Codeforces handle already exists
        const codeforcesResult = await session.run(
            `MATCH (c:Codeforces {handle: $codeforcesHandle}) RETURN c`,
            { codeforcesHandle }
        );

        // Check if GitHub handle already exists
        const githubResult = await session.run(
            `MATCH (g:GitHub {handle: $githubHandle}) RETURN g`,
            { githubHandle }
        );

        if (codeforcesResult.records.length > 0) {
            res.json({"status": `Codeforces User handle already exists ${codeforcesHandle}`});
            console.log(`Codeforces handle ${codeforcesHandle} already exists, hence not adding the user`);
            return;
        }

        if (githubResult.records.length > 0) {
            console.log(`Github handle ${githubHandle} already exists, hence not adding the user`);
            res.json({"status": `Github User handle already exists ${githubHandle}`});
            return;
        }

        // Create the User node
        await session.run(
            'CREATE (u:User {name: $name}) RETURN u',
            { name }
        );

        // Create the Codeforces node and connect it to the User node
        await session.run(
            `MATCH (u:User {name: $name})
             CREATE (u)-[:WITH_CODEFORCES]->(c:Codeforces {handle: $codeforcesHandle})`,
            { name, codeforcesHandle }
        );

        // Create the GitHub node and connect it to the User node
        await session.run(
            `MATCH (u:User {name: $name})
             CREATE (u)-[:WITH_GITHUB]->(g:GitHub {handle: $githubHandle})`,
            { name, githubHandle }
        );

        // Create the Team node and connect it to the User node
        await session.run(
            `MATCH (u:User {name: $name})
             CREATE (u)-[:WITH_TEAM]->(t:Team {name: $team})`,
            { name, team }
        );

        // res.status(201).send('User, Codeforces, GitHub, and Team nodes created successfully');
        console.log(`successfully added ${name} details to db`)
        res.json({Status:"OK", Message:`Successfully created a user ${name} with codeforces & github Handle as ${codeforcesHandle} & ${githubHandle}`});
    }catch (error) {
        console.error('Error creating user and related nodes:', error.message);
        res.status(500).send(`Error While Adding user details: ${error}`);
    }
};

//API that sends team, user's name and codeforcesHandle
const getAllUsersDetails = async (req, res) => {
    try {
        const result = await session.run(`
            MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces),
                  (u)-[:WITH_GITHUB]->(g:GitHub),
                  (u)-[:WITH_TEAM]->(t:Team)
            RETURN u.name AS userName, c.handle AS codeforcesHandle, g.handle AS githubHandle, t.name AS teamName
        `);

        const users = result.records.map(record => ({
            name: record.get('userName'),
            codeforcesHandle: record.get('codeforcesHandle'),
            githubHandle: record.get('githubHandle'),
            team: record.get('teamName')
        }));
        console.log(`All ${users.length} user details have been fetched ... `);
        res.json({Status: "OK", Message:`All ${users.length} user details have been fetched ... `,totalRecords: users.length, data: users});
    } catch (error) {
        console.error('Error fetching user details:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

//API that send team, users's name and all the submissions
const getAllSubmissions = async (req, res) => {
    try {
        const result = await session.run(
            `MATCH (u:User)-[:WITH_TEAM]->(t:Team),
                   (u)-[:WITH_CODEFORCES]->(c:Codeforces)-[:SUBMITTED]->(s:Submission)
             RETURN u.name AS name, t.name AS teamName, collect({
                 contestId: s.contestId,
                 rating: s.rating,
                 problemName: s.problemName,
                 problemId: s.problemId,
                 verdict: s.verdict,
                 creationTimeSeconds: s.creationTimeSeconds
             }) AS submissions`
        );

        const users = result.records.map(record => ({
            name: record.get('name'),
            teamName: record.get('teamName'),
            totalSubmissions: record.get('submissions').length,
            submissions: record.get('submissions')
        }));
        console.log(`All ${users.length} user submissions have been fetched ... `);
        res.json({Status: "OK", Message:`All ${users.length} user submissions have been fetched ... `, totalRecords: users.length ,data: users});
    } catch (error) {
        console.log(`Error retrieving user information: ${error.message}`);
        res.status(500).send(`Error retrieving user information: ${error.message}`);
    }
};

//API to get All the distinct accepted submissions after 18th june for all users
const getDistinctAcceptedSubmissionsAfter18June = async (req, res) => {
    const cutoffDate = new Date('2024-06-18').getTime() / 1000;
    try {
        // Fetch all users with their teams
        const usersResult = await session.run(`
            MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces),
                  (u)-[:WITH_TEAM]->(t:Team)
            RETURN u.name AS userName, c.handle AS codeforcesHandle, t.name AS teamName
        `);

        const users = usersResult.records.map(record => ({
            name: record.get('userName'),
            codeforcesHandle: record.get('codeforcesHandle'),
            team: record.get('teamName'),
            numberOfSubmissions: 0,
            submissions: []
        }));

        // Fetch all relevant submissions after the cutoff date
        const submissionsResult = await session.run(`
            MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces)-[:SUBMITTED]->(s:Submission)
            WHERE s.verdict = 'OK' AND s.creationTimeSeconds > $cutoffDate
            RETURN u.name AS userName, c.handle AS codeforcesHandle, 
                   s.rating AS rating, s.problemId AS problemId, 
                   s.problemName AS problemName, s.submissionId AS submissionId,
                   s.creationTimeSeconds AS creationTimeSeconds, s.tags AS tags
            ORDER BY s.rating
        `, { cutoffDate });

        const submissions = submissionsResult.records.map(record => ({
            userName: record.get('userName'),
            codeforcesHandle: record.get('codeforcesHandle'),
            rating: record.get('rating'),
            problemId: record.get('problemId'),
            problemName: record.get('problemName'),
            submissionId: record.get('submissionId'),
            creationTimeSeconds: record.get('creationTimeSeconds'),
            tags: record.get('tags')
        }));

        const userSubmissionsMap = {};

        // Organize submissions by user
        submissions.forEach(submission => {
            const { userName, codeforcesHandle, rating, problemId, problemName, submissionId, creationTimeSeconds, tags } = submission;

            if (!userSubmissionsMap[userName]) {
                userSubmissionsMap[userName] = {
                    name: userName,
                    codeforcesHandle,
                    team: '',
                    numberOfSubmissions: 0,
                    submissions: [],
                    problemIds: new Set() // To track problem IDs and avoid duplicates
                };
            }

            // Ensure no duplicate submissions for the same problemId
            if (!userSubmissionsMap[userName].problemIds.has(problemId)) {
                userSubmissionsMap[userName].submissions.push({
                    rating,
                    problemId,
                    problemName,
                    submissionId,
                    creationTimeSeconds,
                    tags
                });
                userSubmissionsMap[userName].numberOfSubmissions += 1;
                userSubmissionsMap[userName].problemIds.add(problemId);
            }
        });

        // Merge users with their submissions
        users.forEach(user => {
            if (userSubmissionsMap[user.name]) {
                user.submissions = userSubmissionsMap[user.name].submissions;
                user.numberOfSubmissions = userSubmissionsMap[user.name].numberOfSubmissions;
            }
        });

        console.log(`All the distinct accepted submissions after 18th june for all ${users.length} users have been sent`);
        res.json({Status:"OK", Message:`All the distinct accepted submissions after 18th june for all ${users.length} users have been sent`,totalRecords:users.length, data: users});
    } catch (error) {
        console.error('Error while fetching accepted submissions:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getLastCrawlTimestamp = async (req, res) => {
    try {
        const codeforcesHandle = "vishalkuma4180" // Assuming codeforcesHandle is passed in the request body

        // Run the Cypher query to fetch the timestamp for LastCrawl node
        const result = await session.run(
            `MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces {handle: $codeforcesHandle}),
                   (u)-[:LAST_CRAWL]->(t:CrawlTime)
             RETURN t`,
            { codeforcesHandle }
        );
        if (result.records.length > 0) {
            res.json({Status: "OK", Message: "Fetched last crawl time for codeforces" , LastCrawlTimeStamp: result.records[0]._fields[0].properties.time});
        } else {
            res.status(404).json({ error: `No LastCrawl node found for handle ${codeforcesHandle}` });
        }
    } catch (error) {
        console.error('Error fetching last crawl timestamp:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const addProblems = async (req, res) => {
    const problems = req.body; // Assuming req.body is an array of JSON objects [{ problemId, link }, { problemId, link }, ...]
    try {
        const addedLinks = [];
        
        for (const problem of problems) {
            const problemLink  = problem.problem;

            const link = normalizeLink(problemLink);

            const splitArr = link.split("/");
            const problemId = splitArr[splitArr.length - 2] + "" + splitArr[splitArr.length - 1];

            // Create or merge Problem node with a unique constraint on link
            const result = await session.run(
                `MERGE (p:Problem { link: $link })
                 ON CREATE SET p.problemId = $problemId
                 RETURN p`,
                { link, problemId }
            );

            // Assuming you have a way to identify the CodeforcesSite node, e.g., siteName
            const siteName = 'CODEFORCES'; // Replace with actual identifier

            // Create or match CodeforcesSite node
            await session.run(
                `MERGE (s:CodeforcesSite { handle: $siteName })
                 WITH s
                 MATCH (p:Problem { link: $link })
                 MERGE (s)-[:WITH_LINK]->(p)`,
                { siteName, link }
            );

            addedLinks.push(link); // Collect successfully added links
        }
        console.log(`Problems adedd successfully ... `);
        res.json({Status: "OK", Message: "Added problems succesfully", Links: addedLinks});
    } catch (error) {
        console.error('Error adding problems:', error);
        res.status(500).json({ error: 'Failed to add problems' });
    }
}

const getAddedProblems = async (req, res) => {
    try {
        const result = await session.run(
            'MATCH (site:CodeforcesSite)-[:WITH_LINK]->(problem:Problem) RETURN problem.problemId AS problemId, problem.link AS problemLink'
        );
    
        const problems = result.records.map(record => ({
            problemId: record.get('problemId'),
            problemLink: record.get('problemLink')
        }));
    
        res.json(problems);
    } catch (error) {
        console.error('Error fetching problem details:', error);
        res.status(500).send('Internal Server Error');
    }
}

    const problemsList = async (req, res) => {
        const session = driver.session();
        try {
            const result = await session.run('MATCH (p:Problem) RETURN p.link AS link, p.problemId AS problemId');
            const problems = result.records.map(record => ({
                link: record.get('link'),
                problemId: record.get('problemId')
            }));
            res.json(problems);
        } catch (error) {
            console.error('Error fetching problems:', error);
            res.status(500).send('Error fetching problems');
        }
    };

const updateRatings = async (req, res) => {
    // const users1 = req.body;
    try{
        console.log("started ... ");
        // Step 1: Fetch all users and their Codeforces handles
        const usersResult = await session.run(`
            MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces)
            RETURN u.name AS userName, c.handle AS codeforcesHandle
        `);

        let users = usersResult.records.map(record => ({
            userName: record.get('userName'),
            codeforcesHandle: record.get('codeforcesHandle')
        }));

        if(users.length==0 || !users)
        {
            console.log("no users found");
            return;
        }

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
              error: "Invalid input. Provide an array of users with fields: handle, rating, maxRating, and rank.",
            });
          }

          
        
        for(const user of users)
        {
            const codeforcesHandle = user.codeforcesHandle;
            const response = await axios.get(`https://codeforces.com/api/user.info?handles=${codeforcesHandle}`);

            const { handle, rating, maxRating, rank } = response.data.result[0];
            // break;
            
            if (!handle || rating == null || maxRating == null || rank == null) {
                console.error(`Skipping user with missing fields: ${JSON.stringify(user)}`);
                continue;
            }
            const query = `
            MATCH (c:Codeforces {handle: $handle})
            MERGE (c)-[:HAS_RATING]->(r:Rating)
            SET r.rating = $rating,
            r.rank = $rank
            WITH r, r.maxRating AS previousMaxRating, $maxRating AS newMaxRating
            WHERE newMaxRating > coalesce(previousMaxRating, 0)
            SET r.maxRating = newMaxRating
            RETURN previousMaxRating, r.maxRating AS updatedMaxRating, r.rank AS currentRank
            `;
            
              const result = await session.run(query, {
                handle,
                rating,
                maxRating,
                rank,
              });
          
              // Check if maxRating was updated
              if (result.records.length > 0) {
                const record = result.records[0];
                const previousMaxRating = record.get("previousMaxRating");
                const updatedMaxRating = record.get("updatedMaxRating");
                const currentRank = record.get("currentRank");
                const currentRating  = rating;

                const rank = getRank(currentRating, previousMaxRating);
                console.log("houle", rank);
          
                if ( (updatedMaxRating > (previousMaxRating || 0)) && rank) {
                    const name = handle;
                    const userMail = 'QUERY TO GET THE USER MAIL FOR given handle from neo4j';

                  console.log(`Max rating updated from ${previousMaxRating || 0} to ${updatedMaxRating} for handle: ${handle}`);
                  const textMessage = `
                    Congratulations, ${name}! 🎉 on becoming ${rank}

                    What an incredible milestone in your coding journey! 🌟 You've worked tirelessly and your dedication has led you to this fantastic new rank — we couldn't be more excited for you! 🚀 Your passion and persistence are truly inspiring!

                    You've set a high standard for yourself, and this achievement is just the beginning. The sky’s the limit — keep soaring higher and pushing the boundaries of what’s possible! 💪

                    Best regards,
                    Being Zero Team,
                    Powerful Yet Humble
                    `;
                    // HTML message with <br> for new lines
                    const htmlMessage = `
                    <p><strong>Congratulations ${name} ! 🎉</strong> on getting ${rank} Title on Codeforces</p>

                    <p>What an incredible milestone in your coding journey! 🌟 You've worked tirelessly and your dedication has led you to this fantastic new rank — we couldn't be more excited for you! 🚀 Your passion and persistence are truly inspiring!</p>

                    <p>You've set a high standard for yourself, and this achievement is just the beginning. The sky’s the limit — keep soaring higher and pushing the boundaries of what’s possible! 💪</p>
                    
                    <p>Best regards,<br><strong>Being Zero Team,</strong> <br> <i>Powerful Yet Humble</i></p>
                    `;
                  
                    sendEmail(`${userMail}`, '🎉 Congratulations on Reaching New Heights in Your Coding Journey! 🚀', textMessage, htmlMessage)
                    .then(() => {
                        console.log(`Email sent for acheiving higher rank to ${handle}!`);
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                    });
                }
                console.log(`Current rank for handle ${handle}: ${currentRank}`);
              }
              console.log({ message: `Rating node updated successfully for ${handle}` });
            }
        res.status(200).json({ message: "Ratings updated successfully for all users." });
    }
    catch(error)
    {
        console.error("Error updating rating:", error);
        res.status(500).json({ error: "Internal server error." });
    }
}

// API endpoint to get users and problemIds with verdict as "OK" and existing in Problem node
const userProblemMap = async (req, res) => {

    try {
        // First, get all users
        const userQuery = `MATCH (u:User) RETURN u.name AS userName`;
        const userResult = await session.run(userQuery);
        
        // Create a map for users with empty problem ID arrays
        const userMap = {};
        userResult.records.forEach(record => {
            const userName = record.get('userName');
            userMap[userName] = []; // Initialize with empty array
        });

        // Now get submissions for users with 'OK' verdict
        const submissionQuery = `
            MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces)-[:SUBMITTED]->(s:Submission)
            MATCH (p:Problem {problemId: s.problemId}) // Ensure problemId exists in Problem
            WHERE s.verdict = 'OK'
            RETURN u.name AS userName, COLLECT(s.problemId) AS problemIds
        `;
        const submissionResult = await session.run(submissionQuery);

        // Populate the userMap with actual problem IDs
        submissionResult.records.forEach(record => {
            const userName = record.get('userName');
            const problemIds = record.get('problemIds') || []; // Gets the problem IDs, can be empty

            if (userMap[userName]) {
                userMap[userName] = problemIds; // Assign the IDs to the user
            }
        });

        // Return the user map as JSON
        return res.json(userMap);
        } catch (error) {
            console.error('Error fetching data:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

module.exports = {addUser, getAllUsersDetails, getAllSubmissions, getDistinctAcceptedSubmissionsAfter18June, getLastCrawlTimestamp, addProblems, getAddedProblems, updateRatings, problemsList, userProblemMap};
