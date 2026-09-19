const fs = require('fs');

const TARGET_QUESTION_COUNT = 500; // Set how many total questions you want
const BATCH_SIZE = 50; // OpenTDB API max per request

function decodeHTML(html) {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Pause function to prevent hitting OpenTDB rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBulkQuestions() {
  const uniqueQuestions = new Map();

  console.log(`Starting fetch... Target: ${TARGET_QUESTION_COUNT} questions.`);

  while (uniqueQuestions.size < TARGET_QUESTION_COUNT) {
    try {
      const response = await fetch(`https://opentdb.com/api.php?amount=${BATCH_SIZE}&type=multiple`);
      const data = await response.json();

      if (data.response_code === 0) {
        data.results.forEach((item) => {
          const cleanQ = decodeHTML(item.question);
          
          // Use question text as key to avoid duplicate entries
          if (!uniqueQuestions.has(cleanQ)) {
            const options = [...item.incorrect_answers.map(decodeHTML), decodeHTML(item.correct_answer)];
            
            // Fisher-Yates shuffle options
            for (let i = options.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [options[i], options[j]] = [options[j], options[i]];
            }

            uniqueQuestions.set(cleanQ, {
              q: cleanQ,
              options: options,
              a: options.indexOf(decodeHTML(item.correct_answer))
            });
          }
        });

        console.log(`Fetched pool... Unique questions collected so far: ${uniqueQuestions.size}/${TARGET_QUESTION_COUNT}`);
      } else if (data.response_code === 5) {
        console.log("Rate limited by OpenTDB. Waiting 5 seconds...");
        await sleep(5000);
      }

      // Wait 1.5 seconds between requests to be polite to the API
      await sleep(1500);

    } catch (error) {
      console.error("Error fetching batch, retrying in 3 seconds...", error);
      await sleep(3000);
    }
  }

  const questionArray = Array.from(uniqueQuestions.values());
  fs.writeFileSync('questions.json', JSON.stringify(questionArray, null, 2));
  console.log(`\nSuccess! Saved ${questionArray.length} unique questions to questions.json.`);
}

fetchBulkQuestions();