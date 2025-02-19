const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to run a command and return a Promise that resolves with stdout.
const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Command error:', stderr);
        return reject(error);
      }
      resolve(stdout);
    });
  });
};

/**
 * GET /api/inspirations
 * Query parameters:
 *   - query: The search term (e.g., "modern kitchen design")
 *   - limit: The number of images to fetch (default 30)
 *
 * This endpoint calls the pinterest-dl CLI to perform a search and returns JSON data.
 */
app.get('/api/inspirations', async (req, res) => {
  try {
    // Extract query parameters (with defaults)
    const searchQuery = req.query.query || 'modern kitchen design';
    const limit = req.query.limit || 30;
    
    // Optional: if you have a cookies file, pass it via the PINTEREST_COOKIES environment variable.
    const cookiePath = process.env.PINTEREST_COOKIES || '';
    const cookieOption = cookiePath ? ` --cookie ${cookiePath}` : '';

    // Define a temporary folder for scraping
    const tempFolder = 'temp-search';
    
    // Build the command string.
    // Even though "temp-search" is specified as the output folder,
    // we'll delete it after capturing the JSON data.
    const command = `pinterest-dl search "${searchQuery}" ${tempFolder} -l ${limit} --json${cookieOption}`;

    console.log(`Running command: ${command}`);
    // Execute the command
    const output = await runCommand(command);
    console.log("Raw output:", output);
    
    let jsonData;

    // Check if a JSON file was created (e.g., temp-search.json in the current working directory)
    const jsonFilePath = path.join(process.cwd(), `${tempFolder}.json`);
    if (fs.existsSync(jsonFilePath)) {
      console.log(`Found JSON file at: ${jsonFilePath}`);
      const fileData = fs.readFileSync(jsonFilePath, 'utf8');
      jsonData = JSON.parse(fileData);
    } else {
      // Otherwise, attempt to extract JSON from stdout using a regex.
      const match = output.match(/(\[.*\]|\{.*\})/s);
      if (!match) {
        throw new Error("No JSON data found in the output");
      }
      const jsonPart = match[1].trim();
      jsonData = JSON.parse(jsonPart);
    }
    
    // Clean up: delete the temporary folder and JSON file if they exist
    const tempFolderPath = path.join(process.cwd(), tempFolder);
    if (fs.existsSync(tempFolderPath)) {
      fs.rmSync(tempFolderPath, { recursive: true, force: true });
      console.log(`Deleted temporary folder: ${tempFolderPath}`);
    }
    if (fs.existsSync(jsonFilePath)) {
      fs.unlinkSync(jsonFilePath);
      console.log(`Deleted temporary JSON file: ${jsonFilePath}`);
    }
    
    // Respond with the JSON data
    res.json(jsonData);
  } catch (error) {
    console.error("Error fetching inspirations:", error);
    res.status(500).json({ error: 'Failed to fetch inspirations.' });
  }
});

// Start the server on port 5000 (or use process.env.PORT)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
