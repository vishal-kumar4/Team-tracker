const express=require('express');
const app=express();

require('dotenv').config();
app.use(express.json());

// Creating a limiter by calling rateLimit function with options:
// max contains the maximum number of request and windowMs
// contains the time in millisecond so only max amount of
// request can be made in windowMS time.
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
    max: 200,
    windowMs: 60 * 60 * 1000,
    message: "Too many request from this IP"
});
// Add the limiter function to the express middleware
// so that every request coming from user passes
// through this middleware.
app.use(limiter);

//for cross origin requests
const cors = require('cors');
app.use(cors()) // Use this after the variable declaration

app.listen(3000, ()=>{
    console.log('server is running on port 3000');
});

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
app.get('/codeforces/user/all/handles', userController.getAllUsersDetails);
app.get('/codeforces/user/all/submissions', userController.getAllSubmissions);
app.get('/codeforces/user/all/distinctAccSubmissionsAfter18June', userController.getDistinctAcceptedSubmissionsAfter18June);

