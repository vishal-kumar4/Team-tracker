const express=require('express');

const app=express();

require('dotenv').config();

app.use(express.json())


const cors = require('cors')

app.use(cors()) // Use this after the variable declaration

app.listen(3000, ()=>{
    console.log('server is running on port 3000');
})

const connectToDb = require("./config/connectToDb");
const { Scheduler } = require('./Scheduler/Scheduler');
const { updateAllUserSubmissions } = require('./Jobs/updateAllUserSubmissionsJob');

//call the function for db connects
connectToDb.connectToNeo4j().then(() => {
    const scheduler = new Scheduler("0 10 * * *", updateAllUserSubmissions);
    scheduler.schedule()
});

const userController = require('./controller/neo4jController');

//Routes for API'S
app.post("/codeforces/user/addUser", userController.addUser);
app.post('/codeforces/user/updateSubmissions', userController.addUserSubmissions);
app.get('/codeforces/user/all', userController.getAllCodeforcesHandles);
// app.post('/codeforces/user/all/updateSubmissions', userController.updateAllUserSubmissions);
app.get('/codeforces/team/allUsers', userController.teamData);
app.get('/codeforces/team/allSubmissions', userController.getTeamSubmissions);
app.get('/codeforces/team/allAccSubmissions', userController.getAcceptedSubumissions);

app.get('/github/user/all', userController.getAllGithubHandles);