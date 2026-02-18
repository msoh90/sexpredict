require('dotenv').config({ path: '.env.local' });
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files (index.html, styles.css, script.js)

// Google Sheets Setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const authOptions = {};
if (process.env.PRIVATE_KEY && process.env.CLIENT_EMAIL) {
    // Production (Vercel) environment
    authOptions.credentials = {
        client_email: process.env.CLIENT_EMAIL,
        private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
} else {
    // Local environment
    authOptions.keyFile = '../google-key.json';
}

authOptions.scopes = SCOPES;

const auth = new google.auth.GoogleAuth(authOptions);



const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// API Endpoint to record data
app.post('/api/record-harmony', async (req, res) => {
    try {
        console.log('[API] Processing Payload:', JSON.stringify(req.body, null, 2));
        const { dadDate, momDate, childDate, prediction, result, actualSex, conceptionYear, mode } = req.body;

        if (!dadDate || !momDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'America/Toronto' });

        // Format YYYY-MM-DD to YYYY.MM.DD
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            return dateStr.replace(/-/g, '.');
        };

        // 1. Determine Target Sheet & Diagnostic Read
        let targetRange = 'Sheet1';
        let targetSheetId = 0;
        try {
            const ssMetadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
            const sheetsList = ssMetadata.data.sheets;
            const sheetNames = sheetsList.map(s => s.properties.title);

            const s1Index = sheetNames.indexOf('Sheet1');
            if (s1Index !== -1) {
                targetRange = 'Sheet1';
                targetSheetId = sheetsList[s1Index].properties.sheetId;
            } else {
                targetRange = sheetNames[0];
                targetSheetId = sheetsList[0].properties.sheetId;
            }
        } catch (diagErr) {
            console.error('[Error] Failed to fetch spreadsheet metadata:', diagErr.response ? diagErr.response.data : diagErr.message);
        }

        // 2. Check if the target sheet is empty (to decide on headers)
        let needsHeaders = false;
        try {
            const getRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${targetRange}!A1:A1`,
            });
            if (!getRes.data.values || getRes.data.values.length === 0) {
                needsHeaders = true;
            }
        } catch (err) {
            needsHeaders = true;
        }

        const rowsToAdd = [];
        if (needsHeaders) {
            rowsToAdd.push(['입력시간', '아빠생일', '엄마생일', '타겟연도', '계산결과', '실제성별', '모드']);
        }

        const payload = {
            dadDate,
            momDate,
            childDate,
            conceptionYear,
            prediction,
            actualSex,
            mode
        };

        console.log('[DEBUG] Final Save Payload:', payload);

        const row = [
            timestamp,
            formatDate(dadDate),
            formatDate(momDate),
            formatDate(childDate) || conceptionYear,
            prediction, // 계산결과 (Column E)
            actualSex,  // 실제성별 (Column F)
            mode        // 모드 (Column G)
        ];

        console.log('[DEBUG] Final Row for Sheets:', JSON.stringify(row));
        rowsToAdd.push(row);

        // 3. Append data
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: rowsToAdd,
            },
        });

        // --- NEW: Reset Row Background to White first, then highlight if mismatch ---
        try {
            const updatedRange = response.data.updates.updatedRange;
            console.log(`[DEBUG] Updated Range: ${updatedRange}`);

            // Match both A1:G1 and A1:G2 formats
            const rowMatch = updatedRange.match(/!A(\d+)(?::G(\d+))?/);
            if (rowMatch) {
                const startRowIndex = parseInt(rowMatch[1]) - 1; // 0-indexed
                const endRowIndex = rowMatch[2] ? parseInt(rowMatch[2]) : startRowIndex + 1;

                const requests = [];

                // 1. Always Reset Background to White [USER REQUEST]
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: targetSheetId,
                            startRowIndex: startRowIndex,
                            endRowIndex: endRowIndex,
                            startColumnIndex: 0,
                            endColumnIndex: 7
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 } // White
                            }
                        },
                        fields: 'userEnteredFormat.backgroundColor'
                    }
                });

                // 2. Conditional Formatting: Highlight row if Verify mode and mismatch
                if (mode === '검증' && prediction !== actualSex) {
                    requests.push({
                        repeatCell: {
                            range: {
                                sheetId: targetSheetId,
                                startRowIndex: startRowIndex,
                                endRowIndex: endRowIndex,
                                startColumnIndex: 0,
                                endColumnIndex: 7
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 1.0, green: 0.9, blue: 0.9 } // Light Pink
                                }
                            },
                            fields: 'userEnteredFormat.backgroundColor'
                        }
                    });
                }

                if (requests.length > 0) {
                    console.log(`[DEBUG] Sending batchUpdate with ${requests.length} requests for rows ${startRowIndex + 1}-${endRowIndex}`);
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId: SPREADSHEET_ID,
                        resource: { requests }
                    });
                    console.log(`[Success] Applied formatting to rows ${startRowIndex + 1}-${endRowIndex}. (White Reset + Condition)`);
                }
            }
        } catch (fmtErr) {
            console.error('[Error] Failed to apply formatting:', fmtErr.message);
        }
        // --------------------------------------------------------------------------

        console.log(`[Success] Data recorded to "${targetRange}". Prediction: ${prediction}, Mode: ${mode}`);
        res.status(200).json({ message: 'Success', updates: response.data.updates });

    } catch (error) {
        const errData = error.response ? error.response.data : error.message;
        console.error('[Error] Google API failure:', errData);
        // Temporarily exposing detailed error to the client for easier debugging on mobile
        res.status(500).json({
            error: 'Failed to record data',
            details: errData,
            envCheck: {
                hasSheetId: !!process.env.GOOGLE_SHEET_ID,
                hasEmail: !!process.env.CLIENT_EMAIL,
                hasKey: !!process.env.PRIVATE_KEY
            }
        });
    }
});




// Build Trigger #2: Triggering redeploy after environment variable setup
app.listen(PORT, '0.0.0.0', () => {

    // Build Trigger #3: Redeploying after fixing PRIVATE_KEY double quote issue
    console.log(`Server running on http://0.0.0.0:${PORT}`);

    if (!SPREADSHEET_ID) console.warn('WARNING: GOOGLE_SHEET_ID is missing from .env.local');
});

// Build Trigger: Manual update to redeploy to Vercel
// Build Trigger #4: Manual trigger at 2026-02-18 18:18
module.exports = app;




