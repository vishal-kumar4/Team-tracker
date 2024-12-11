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

  const ranks = [
      { name: 'Newbie', minRating: 0, maxRating: 1199 },
      { name: 'Pupil', minRating: 1200, maxRating: 1399 },
      { name: 'Specialist', minRating: 1400, maxRating: 1599 },
      { name: 'Expert', minRating: 1600, maxRating: 1899 },
      { name: 'Candidate Master', minRating: 1900, maxRating: 2199 },
      { name: 'Master', minRating: 2200, maxRating: 2399 },
      { name: 'International Master', minRating: 2400, maxRating: 2599 },
      { name: 'Grandmaster', minRating: 2600, maxRating: Infinity } // Assuming no upper limit
  ];

  function getRank(currentRating, previousMaxRating) {
    // Check if the user reached a new maximum rating
    if (currentRating > previousMaxRating) {
        // Find the new rank based on current rating
        const newRank = ranks.find(rank => 
            currentRating >= rank.minRating && currentRating <= rank.maxRating
        );

        if (newRank) {
            // Check if this rank was already achieved
            if (previousRank !== newRank.name) {
                previousRank = newRank.name; // Update the previous rank
                return newRank.name; // Return the new rank
            }
        }
    }
    return ''; // Return an empty string if no new rank is achieved
}

module.exports = {capitalize, normalizeLink, getRank}