// API Configuration
const API_URL = "http://localhost:8080/score?persist=3&group_by=user_id";
const SEND_INTERVAL = 120000; // 2 minutes in milliseconds

// Store interval ID for cleanup
let apiInterval = null;

/**
 * Fetch last 5 records for a user from merged CSV file
 * @param {string} userFolder - User folder name (e.g., 'user_1')
 * @param {number} userId - User ID number
 * @returns {Promise<Array>} Array of last 5 data records
 */
async function getLast5Records(userFolder, userId) {
    console.log('=== GET LAST 5 RECORDS CALLED ===');
    console.log('User folder:', userFolder, 'User ID:', userId);
    
    const currentTime = new Date();
    console.log('Current time:', currentTime);
    
    const records = [];

    try {
        console.log('Fetching CSV file...');
        // Fetch merged CSV file
        const response = await fetch(`../dataset2/all_users_5min_merged.csv`);
        console.log('CSV fetch response status:', response.status);
        
        const text = await response.text();
        console.log('CSV text length:', text.length);
        
        // Parse CSV
        const lines = text.trim().split('\n');
        console.log('Total lines in CSV:', lines.length);
        
        const headers = lines[0].split(',');
        console.log('CSV headers:', headers);
        
        // Filter records for this user with timestamp < current time
        const userRecords = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const timestamp = values[0]; // First column is timestamp
            const rowUserId = parseInt(values[1]); // Second column is user_id
            
            // Parse timestamp and compare with current time
            const recordTime = new Date(timestamp);
            
            if (rowUserId === userId && recordTime <= currentTime) {
                // Build record object matching CSV column order
                const record = {
                    user_id: rowUserId,
                    timestamp: timestamp,
                    Temp_F: parseFloat(values[2]) || 0,
                    SBP_mmHg: parseFloat(values[3]) || 0,
                    DBP_mmHg: parseFloat(values[4]) || 0,
                    MAP_mmHg: parseFloat(values[5]) || 0,
                    HR_bpm: parseFloat(values[6]) || 0,
                    HRV_rmssd_ms: parseFloat(values[7]) || 0,
                    RR_bpm: parseFloat(values[8]) || 0,
                    SpO2_pct: parseFloat(values[9]) || 0,
                    asleep: parseInt(values[26]) || 0,
                    Temp_F_mask: parseInt(values[10]) || 0,
                    SBP_mmHg_mask: parseInt(values[11]) || 0,
                    DBP_mmHg_mask: parseInt(values[12]) || 0,
                    MAP_mmHg_mask: parseInt(values[13]) || 0,
                    HR_bpm_mask: parseInt(values[14]) || 0,
                    HRV_rmssd_ms_mask: parseInt(values[15]) || 0,
                    RR_bpm_mask: parseInt(values[16]) || 0,
                    SpO2_pct_mask: parseInt(values[17]) || 0,
                    asleep_mask: 1
                };
                userRecords.push(record);
                
                // Only log first few matching records to avoid console spam
                if (userRecords.length <= 3) {
                    console.log('Added record:', record);
                }
            }
        }

        console.log('Total records for user', userId, ':', userRecords.length);
        
        // Get last 5 records
        records.push(...userRecords.slice(-5));
        
        console.log('Returning', records.length, 'records');

    } catch (error) {
        console.error('=== ERROR IN GET LAST 5 RECORDS ===');
        console.error(`Error fetching data for user ${userId}:`, error);
    }

    return records;
}

/**
 * Send data to API endpoint
 * @param {Array} records - Array of user records
 * @returns {Promise<Array>} Parsed API response
 */
async function sendToAPI(records) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({ records });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    try {
        console.log('=== SENDING TO API ===');
        console.log('API URL:', API_URL);
        console.log('Number of records:', records.length);
        console.log('Payload:', raw);
        
        const response = await fetch(API_URL, requestOptions);
        
        console.log('Response status:', response.status);
        console.log('Response OK:', response.ok);
        
        const resultText = await response.text();
        console.log('API Response:', resultText);
        
        // Parse JSON response
        const parsedResult = JSON.parse(resultText);
        return parsedResult;
    } catch (error) {
        console.error('=== API ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        throw error;
    }
}

/**
 * Collect and send last 5 records for currently selected user
 */
async function collectAndSendData() {
    console.log('=== COLLECT AND SEND DATA CALLED ===');
    console.log('Collecting last 5 records for selected user...');
    
    // Get currently selected user from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const selectedUserFolder = urlParams.get('user') || 'user_1'; // e.g., 'user_1'
    const userId = parseInt(selectedUserFolder.split('_')[1]); // Extract user ID number
    
    console.log('Selected user folder:', selectedUserFolder);
    console.log('User ID:', userId);

    try {
        console.log('About to call getLast5Records...');
        // Collect last 5 records for selected user
        const records = await getLast5Records(selectedUserFolder, userId);
        
        console.log(`Collected ${records.length} records for ${selectedUserFolder}`);
        console.log('Records:', records);

        if (records.length === 0) {
            console.warn('No valid records found to send');
            const statusElement = document.getElementById('api-status');
            if (statusElement) {
                statusElement.textContent = 'No data available to send';
                statusElement.style.color = '#ff9800';
            }
            return;
        }

        console.log('About to call sendToAPI with', records.length, 'records');
        // Send to API and get response
        const apiResponse = await sendToAPI(records);
        
        console.log('sendToAPI completed successfully');
        console.log('API response data:', apiResponse);
        
        // Update health status based on API response
        if (apiResponse && apiResponse.length > 0) {
            // Get the latest record from the response (last item)
            const latestRecord = apiResponse[apiResponse.length - 1];
            const ruleMatchAny = latestRecord.rule_match_any || 0;
            const ruleExplain = latestRecord.rule_explain || '';
            
            console.log('Latest record rule_match_any:', ruleMatchAny);
            console.log('Latest record rule_explain:', ruleExplain);
            
            // Update health status display
            const healthStatusElement = document.getElementById('health-status');
            if (healthStatusElement) {
                if (ruleMatchAny === 0) {
                    healthStatusElement.textContent = 'Status: Normal';
                    healthStatusElement.style.backgroundColor = '#4caf50';
                    healthStatusElement.style.color = '#ffffff';
                } else {
                    healthStatusElement.textContent = 'Status: Abnormal';
                    healthStatusElement.style.backgroundColor = '#f44336';
                    healthStatusElement.style.color = '#ffffff';
                }
                console.log('Health status updated:', ruleMatchAny === 0 ? 'Normal' : 'Abnormal');
            }
            
            // Update rule explanation display
            const ruleExplanationElement = document.getElementById('rule-explanation');
            if (ruleExplanationElement) {
                if (ruleMatchAny !== 0 && ruleExplain) {
                    ruleExplanationElement.textContent = `⚠️ ${ruleExplain}`;
                    ruleExplanationElement.style.display = 'inline';
                } else {
                    ruleExplanationElement.textContent = '';
                    ruleExplanationElement.style.display = 'none';
                }
                console.log('Rule explanation updated:', ruleMatchAny !== 0 ? ruleExplain : 'Hidden');
            }
        }
        
        // Update last send time display
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
        
        const statusElement = document.getElementById('api-status');
        if (statusElement) {
            statusElement.textContent = `Last updated: ${timeStr}`;
            statusElement.style.color = '#4caf50';
        }
        
    } catch (error) {
        console.error('=== ERROR IN COLLECT AND SEND DATA ===');
        console.error('Error in collectAndSendData:', error);
        const statusElement = document.getElementById('api-status');
        if (statusElement) {
            statusElement.textContent = `API Error: ${error.message}`;
            statusElement.style.color = '#f44336';
        }
    }
}

/**
 * Start automatic data sending every 2 minutes
 */
function startAutoSend() {
    console.log('Starting automatic API data sending (every 2 minutes)...');
    
    // Clear any existing interval first
    if (apiInterval) {
        clearInterval(apiInterval);
        apiInterval = null;
    }
    
    // Send immediately on start
    collectAndSendData();
    
    // Then send every 2 minutes
    apiInterval = setInterval(collectAndSendData, SEND_INTERVAL);
}

/**
 * Stop automatic data sending
 */
function stopAutoSend() {
    if (apiInterval) {
        clearInterval(apiInterval);
        apiInterval = null;
        console.log('Stopped automatic API data sending');
    }
}

// Auto-start when script loads
if (typeof window !== 'undefined') {
    console.log('=== API.JS LOADED ===');
    console.log('Will send data to:', API_URL);
    console.log('Interval:', SEND_INTERVAL / 1000, 'seconds');
    
    window.addEventListener('DOMContentLoaded', () => {
        console.log('=== DOM LOADED - STARTING AUTO SEND ===');
        startAutoSend();
    });
}

// Export functions for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startAutoSend,
        stopAutoSend,
        collectAndSendData,
        sendToAPI
    };
}
