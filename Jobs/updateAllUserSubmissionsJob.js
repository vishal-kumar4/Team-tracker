const driver = require('../config/connectToDb').driver
const session =driver.session();

const axios = require('axios')

const updateAllUserSubmissions = async () => {
    console.log("job started .... .. . . ");
    try {
        console.log("started ... ")
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
            // res.json({"status":"OK", "message": "no users found to fetch submissions"});
            console.log("no users found");
            return;
        }

        for (const user of users) {
            const { codeforcesHandle } = user;
            console.log("crawling started for", codeforcesHandle)
            
            // Step 2: Fetch latest submissions from Codeforces
            const response = await axios.get(`https://codeforces.com/api/user.status?handle=${codeforcesHandle}`);
            const submissions = response.data.result;

            // Check if there are new submissions to process
            if (submissions.length === 0) {
                console.log(`No new submissions found for ${codeforcesHandle}. Skipping.`);
                continue;
            }

            // Check if the number of new submissions is greater than what is already stored
            const storedSubmissionsResult = await session.run(
                `MATCH (:Codeforces {handle: $codeforcesHandle})-[:SUBMITTED]->(s:Submission)
                    RETURN COUNT(s) AS count`,
                { codeforcesHandle }
            );

            const storedSubmissionsCount = storedSubmissionsResult.records[0].get('count').toNumber();

            if (submissions.length <= storedSubmissionsCount) {
                console.log(`No new submissions found for ${codeforcesHandle}. so Skipping...`);
                continue;
            }

            let newSubmissions = [];

            for (const submission of submissions) {
                let { id, contestId, creationTimeSeconds, problem: { rating = 0, name: problemName, index, tags = [] }, verdict } = submission;
                const problemId = `${contestId}${index}`;
                contestId=!contestId?"0":contestId;

                // Check if the submission with the same submissionId already exists
                const submissionExists = await session.run(
                    `MATCH (c:Codeforces {handle: $codeforcesHandle})-[:SUBMITTED]->(s:Submission {submissionId: $id}) RETURN s`,
                    { codeforcesHandle, id }
                );

                if (submissionExists.records.length > 0) {
                    console.log(`Submission with ${id} already exists for`, codeforcesHandle);
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
                        creationTimeSeconds: $creationTimeSeconds,
                        tags: $tags
                    })`,
                    { 
                        codeforcesHandle,
                        id,
                        rating, 
                        contestId, 
                        problemName, 
                        problemId, 
                        verdict,
                        creationTimeSeconds,
                        tags
                    }
                );
                
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
            if(newSubmissions.length==0)
            {
                console.log("No new submissions found for", codeforcesHandle);
            }
            else{
                console.log(`${newSubmissions.length} New submissions added for ${codeforcesHandle}`);
            }
        }
        console.log("Submissions updated for all users.");
        // res.json({ status: "success", message: "Submissions updated for all users."});
    } catch (error) {
        console.error('Error updating submissions:', error.message);
        // res.status(500).send('Internal Server Error');
    }
}

module.exports = {updateAllUserSubmissions}