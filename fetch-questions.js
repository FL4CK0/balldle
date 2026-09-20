const fs = require('fs');

const TARGET_QUESTION_COUNT = 2000; // Set target to 2000 questions
const BATCH_SIZE = 50; // OpenTDB API max per request

// Decodes basic HTML entities, numeric entities, accents, and special typography
function decodeHTML(html) {
  if (!html) return '';

  return html
    // Decimal numeric entities (e.g., &#39;)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(dec))
    // Hex numeric entities (e.g., &#x27;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // Basic XML/HTML entities
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Typography & Special Characters
    .replace(/&deg;/g, '°')
    .replace(/&shy;/g, '') // Soft hyphen
    .replace(/&hellip;/g, '…')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '—')
    .replace(/&prime;/g, "′")
    .replace(/&Prime;/g, '″')
    // Accented / Special Named Characters
    .replace(/&([a-zA-Z]+);/g, (match, entity) => {
      const entityMap = {
        aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í',
        oacute: 'ó', Oacute: 'Ó', uacute: 'ú', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ',
        auml: 'ä', Auml: 'Ä', euml: 'ë', Euml: 'Ë', iuml: 'ï', Iuml: 'Ï',
        ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', agrave: 'à', Agrave: 'À',
        egrave: 'è', Egrave: 'È', igrave: 'ì', Igrave: 'Ì', ograve: 'ò', Ograve: 'Ò',
        ugrave: 'ù', Ugrave: 'Ù', acirc: 'â', Acirc: 'Â', ecirc: 'ê', Ecirc: 'Ê',
        icirc: 'î', Icirc: 'Î', ocirc: 'ô', Ocirc: 'Ô', ucirc: 'û', Ucirc: 'Û',
        aring: 'å', Aring: 'Å', aelig: 'æ', AElig: 'Æ', ccedil: 'ç', Ccedil: 'Ç',
        szlig: 'ß'
      };
      return entityMap[entity] || match;
    });
}

// Pause function to prevent hitting OpenTDB rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Acquire session token from OpenTDB to prevent receiving duplicate questions
async function getSessionToken() {
  try {
    const res = await fetch('https://opentdb.com/api_token.php?command=request');
    const data = await res.json();
    return data.token;
  } catch (err) {
    console.error('Failed to get session token, proceeding without token:', err);
    return null;
  }
}

async function fetchBulkQuestions() {
  const uniqueQuestions = new Map();
  const token = await getSessionToken();

  console.log(`Starting fetch... Target: ${TARGET_QUESTION_COUNT} questions.`);
  if (token) console.log(`Session Token acquired: ${token}`);

  while (uniqueQuestions.size < TARGET_QUESTION_COUNT) {
    try {
      const url = token
        ? `https://opentdb.com/api.php?amount=${BATCH_SIZE}&type=multiple&token=${token}`
        : `https://opentdb.com/api.php?amount=${BATCH_SIZE}&type=multiple`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.response_code === 0) {
        data.results.forEach((item) => {
          const cleanQ = decodeHTML(item.question);

          if (!uniqueQuestions.has(cleanQ) && uniqueQuestions.size < TARGET_QUESTION_COUNT) {
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
      } else if (data.response_code === 4) {
        console.log("Token exhausted! Reached the maximum available questions in OpenTDB.");
        break;
      } else if (data.response_code === 5) {
        console.log("Rate limited by OpenTDB. Waiting 5 seconds...");
        await sleep(5000);
      }

      // Wait 2 seconds between batch requests to remain within rate limits
      await sleep(2000);

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