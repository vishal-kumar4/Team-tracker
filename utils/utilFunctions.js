function capitalize(str) {
    if (typeof str !== 'string' || str.length === 0) {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  
  function normalizeLink(str){
      const splitArr = str.split("/");
      const n = splitArr.length;
      if(splitArr.includes("contest"))
      {
        return `https://codeforces.com/problemset/problem/${splitArr[n-3]}/${splitArr[n-1]}`
      }
      return str;
    }

module.exports = {capitalize, normalizeLink}