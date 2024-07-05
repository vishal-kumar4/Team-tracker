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
    const cutoffDate = new Date('2024-06-17').getTime() / 1000;
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

module.exports = {addUser, getAllUsersDetails, getAllSubmissions, getDistinctAcceptedSubmissionsAfter18June}