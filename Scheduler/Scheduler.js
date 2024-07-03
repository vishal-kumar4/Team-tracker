const nc = require("node-cron");

class Scheduler {
  #time;
  #job;

  constructor(time, job) {
    this.#job = job;
    this.#time = time;
  }

  schedule() {
      nc.schedule(this.#time, this.#job);
      console.log("Job was scheduled ... ");
  }
};
module.exports = {Scheduler}