const driver = require('../config/connectToDb').driver;
const session =driver.session();

const axios = require('axios');

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
            return;
        }

        if (githubResult.records.length > 0) {
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
        res.json({status:`Successfully created a user ${name}`});
    }catch (error) {
        console.error('Error creating user and related nodes:', error.message);
    }
};

//API to get list of all the
const getAllCodeforcesHandles = async(req, res) => {
    try {
        const result = await session.run(
            'MATCH (:User)-[:WITH_CODEFORCES]->(c:Codeforces) RETURN c.handle AS handle'
        );
        const handles = result.records.map(record => record.get('handle'));

        console.log('Codeforces Handles are', handles);
        res.json({status: "successfully fetched all codeforces user handles", totalUsers: handles.length, allUserHandles: handles});
    } catch (error) {
        console.error('Error retrieving codeforces handles:', error);
    }
};

//API to get list of all the
const getAllGithubHandles = async(req, res) => {
    try {
        const result = await session.run(
            'MATCH (:User)-[:WITH_GITHUB]->(g:GitHub) RETURN g.handle AS handle'
        );
        const handles = result.records.map(record => record.get('handle'));

        console.log('Github Handles are', handles);
        res.json({status: "successfully fetched all github user handles", totalUsers: handles.length, allUserHandles: handles});
    } catch (error) {
        console.error('Error retrieving Github handles:', error);
    }
};

//API to crawl non existing-submissions for a user
// const addUserSubmissions = async (req, res) => {
//     const codeforcesHandle = req.body.codeforcesHandle;
//     let newSubmissions = [];

//     try {
//         const response = await axios.get(`https://codeforces.com/api/user.status?handle=${codeforcesHandle}`);
//         const submissions = response.data.result;

//         for (const submission of submissions) {
//             const { id, contestId, problem: { rating = 0, name: problemName, index }, verdict } = submission;
//             const problemId = `${contestId}${index}`;

//             // Check if the submission with the same problemId already exists
//             const submissionExists = await session.run(
//                 `MATCH (c:Codeforces {handle: $codeforcesHandle})-[:SUBMITTED]->(s:Submission {submissionId: $id}) RETURN s`,
//                 { codeforcesHandle, id }
//             );

//             if (submissionExists.records.length > 0) {
//                 console.log(`Submission with submissionId ${id} already exists`);
//                 continue;
//             }

//             // Create the Submission node if it doesn't exist
//             await session.run(
//                 `MATCH (c:Codeforces {handle: $codeforcesHandle})
//                  CREATE (c)-[:SUBMITTED]->(s:Submission {
//                     submissionId: $id,
//                     rating: $rating,
//                     contestId: $contestId,
//                     problemName: $problemName,
//                     problemId: $problemId,
//                     verdict: $verdict
//                 })`,
//                 { 
//                     codeforcesHandle,
//                     id,
//                     rating, 
//                     contestId, 
//                     problemName, 
//                     problemId, 
//                     verdict 
//                 }
//             );

//             // Add the new submission to the newSubmissions array
//             newSubmissions.push({
//                 submissionId: id,
//                 rating,
//                 contestId,
//                 problemName,
//                 problemId,
//                 verdict
//             });
//         }

//         console.log(`New submissions for ${codeforcesHandle}:`, newSubmissions);
//         res.json({ status: "successfully fetched the submission", newSubmissions });
//     } catch (error) {
//         console.error('Error adding submissions:', error.message);
//         res.status(500).send('Internal Server Error');
//     }
// };

const addUserSubmissions = async (req, res) => {
    const codeforcesHandle = req.body.codeforcesHandle;
    let newSubmissions = [];

    try {
        const response = await axios.get(`https://codeforces.com/api/user.status?handle=${codeforcesHandle}`);
        const submissions = response.data.result;

        for (const submission of submissions) {
            const { id, contestId, creationTimeSeconds, problem: { rating = 0, name: problemName, index, tags }, verdict } = submission;
            const problemId = `${contestId}${index}`;

            // Check if the submission with the same problemId already exists
            const submissionExists = await session.run(
                `MATCH (c:Codeforces {handle: $codeforcesHandle})-[:SUBMITTED]->(s:Submission {submissionId: $id}) RETURN s`,
                { codeforcesHandle, id }
            );

            if (submissionExists.records.length > 0) {
                console.log(`Submission with submissionId ${id} already exists`);
                continue;
            }

            // Create the Submission node if it doesn't exist
            await session.run(
                `MATCH (c:Codeforces {handle: $codeforcesHandle})
                 CREATE (c)-[:SUBMITTED]->(s:Submission {
                    submissionId: $id,
                    rating: $rating,
                    contestId: $contestId,
                    problemName: $problemName,
                    problemId: $problemId,
                    verdict: $verdict,
                    creationTimeSeconds: $creationTimeSeconds
                })`,
                { 
                    codeforcesHandle,
                    id,
                    rating, 
                    contestId, 
                    problemName, 
                    problemId, 
                    verdict,
                    creationTimeSeconds
                }
            );

            // Create Tag nodes and connect them to the Submission node
            for (const tag of tags) {
                await session.run(
                    `MERGE (t:Tag {name: $tagName})
                     MERGE (s:Submission {submissionId: $id})
                     MERGE (s)-[:TAGGED_WITH]->(t)`,
                    { tagName: tag, id }
                );
            }

            // Add the new submission to the newSubmissions array
            newSubmissions.push({
                submissionId: id,
                rating,
                contestId,
                problemName,
                problemId,
                verdict,
                creationTimeSeconds,
                tags
            });
        }

        console.log(`New submissions for ${codeforcesHandle}:`, newSubmissions);
        res.json({ status: "successfully fetched the submission", newSubmissions, totalSubmissions: newSubmissions.length });
    } catch (error) {
        console.error('Error adding submissions:', error.message);
        res.status(500).send('Internal Server Error');
    }
};


//API that sends team, user's name and codeforcesHandle
const teamData = async (req, res) => {
    try {
        const result = await session.run(
            `MATCH (u:User)-[:WITH_CODEFORCES]->(c:Codeforces), (u)-[:WITH_TEAM]->(t:Team)
             RETURN u.name AS name, c.handle AS codeforcesHandle, t.name AS teamName`
        );

        const users = result.records.map(record => ({
            name: record.get('name'),
            codeforcesHandle: record.get('codeforcesHandle'),
            teamName: record.get('teamName')
        }));
        console.log("All user records along with team name were fetched successfully");
        res.json({status:"successfully fetched all users and team data", totalUsers: users.length, users: users});
    } catch (error) {
        res.status(500).send(`Error retrieving user information: ${error.message}`);
    }
};

//API that send team, users's name and all the submissions
const getTeamSubmissions = async (req, res) => {
    try {
        const result = await session.run(
            `MATCH (u:User)-[:WITH_TEAM]->(t:Team),
                   (u)-[:WITH_CODEFORCES]->(c:Codeforces)-[:SUBMITTED]->(s:Submission)
             RETURN u.name AS name, t.name AS teamName, collect({
                 contestId: s.contestId,
                 rating: s.rating,
                 problemName: s.problemName,
                 problemId: s.problemId,
                 verdict: s.verdict
             }) AS submissions`
        );

        const users = result.records.map(record => ({
            name: record.get('name'),
            teamName: record.get('teamName'),
            submissions: record.get('submissions')
        }));
        console.log("All submissions records users along with team name were fetched successfully");
        res.json({status: "Successfully fetched data for all users", totalUsers: users.length ,submissionRecords: users});
    } catch (error) {
        res.status(500).send(`Error retrieving user information: ${error.message}`);
    }
};

module.exports = { addUser, getAllCodeforcesHandles, getAllGithubHandles, addUserSubmissions, teamData, getTeamSubmissions };