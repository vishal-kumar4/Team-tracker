if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
  }
  let mongoose = require("mongoose");
  
  //! function to connect to db
  let connectToMongoDb = async () => {
    try {
      await mongoose.connect(process.env.CONNECTION_URL);
      console.log("Connected to mongo DB ... ");
    } catch (error) {
      console.log(error);
    }
  };

  //for neo4j 
  const neo4j = require("neo4j-driver");
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  //check for connectivity
  async function connectToNeo4j() {
    try {
      await driver.verifyConnectivity();
      console.log("Connection to Neo4j was successful !!");
    } catch (error) {
      console.error("Error connecting to Neo4j:", error);
    }
  }
  
  module.exports = {
    connectToMongoDb,
    connectToNeo4j,
    driver
  };
  


  // new commit