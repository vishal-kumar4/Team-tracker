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

//call the function for db connects
connectToDb.connectToNeo4j();

const userController = require('./controller/neo4jController');

//Routes for API'S
app.post("/codeforces/user/addUser", userController.addUser);
app.post('/codeforces/user/addSubmissions', userController.addUserSubmissions);
app.get('/codeforces/user/all', userController.getAllCodeforcesHandles);
app.get('/codeforces/team/allUsers', userController.teamData);
app.get('/codeforces/team/allSubmissions', userController.getTeamSubmissions);

app.get('/github/user/all', userController.getAllGithubHandles);