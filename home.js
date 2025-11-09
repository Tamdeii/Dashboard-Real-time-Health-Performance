// Configuration
const USERS = [
    { id: 1, name: 'Albus Dumbledore', folder: 'user_1' },
    { id: 2, name: 'Harry Potter', folder: 'user_2' },
    { id: 3, name: 'Ron Weasley', folder: 'user_3' },
    { id: 4, name: 'Hermione Granger', folder: 'user_4' },
    { id: 5, name: 'Lord Voldemort', folder: 'user_5' }
];

// API Configuration
const API_URL = "http://localhost:8080/score?persist=3&group_by=user_id";
const SEND_INTERVAL = 120000; // 2 minutes in milliseconds

// Store interval ID for cleanup
let apiInterval = null;

// Store latest API responses for each user
let userHealthStatus = {};
// Initialize with default values
USERS.forEach(user => {
    userHealthStatus[user.id] = {
        status: 'loading',
        lastUpdate: 'Loading...',
        ruleMatchAny: null
    };
});

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Update current time display
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    document.getElementById('current-time').textContent = `Current Time: ${timeString}`;
}

// Render user table
async function renderUserTable() {
    const tbody = document.getElementById('user-table-body');
    
    // If no health status data yet, show loading
    const hasData = Object.keys(userHealthStatus).length > 0;
    if (!hasData) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading user data...</td></tr>';
        return;
    }
    
    const rows = [];
    
    // Create table rows using stored health status
    USERS.forEach((user) => {
        const health = userHealthStatus[user.id] || {
            status: 'loading',
            lastUpdate: 'Loading...'
        };
        
        const statusText = health.status === 'healthy' ? 'Normal' : health.status === 'abnormal' ? 'Abnormal' : 'Loading...';
        const statusColor = health.status === 'healthy' ? '#4caf50' : health.status === 'abnormal' ? '#f44336' : '#666';
        
        const row = `
            <tr>
                <td class="user-id">${user.id}</td>
                <td class="patient-name">${user.name}</td>
                <td>
                    <span style="font-weight: 600; color: ${statusColor}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="view-btn" onclick="viewDashboard('${user.folder}')">
                        View Details
                    </button>
                </td>
            </tr>
        `;
        
        rows.push(row);
    });
    
    tbody.innerHTML = rows.join('');
}

// Navigate to user dashboard
function viewDashboard(userFolder) {
    const todayDate = getTodayDate();
    window.location.href = `D3Visualization.html?user=${userFolder}&date=${todayDate}`;
}

// Auto-refresh table every 5 minutes (just re-render with current data)
function startAutoRefresh() {
    setInterval(() => {
        console.log('Auto-refreshing user status display...');
        renderUserTable();
    }, 300000); // 5 minutes
}

/**
 * Fetch last 5 records for a user from merged CSV file
 * @param {number} userId - User ID number
 * @returns {Promise<Array>} Array of last 5 data records
 */
async function getLast5Records(userId) {
    const currentTime = new Date();
    const records = [];

    try {
        // Fetch merged CSV file
        const response = await fetch(`../dataset2/all_users_5min_merged.csv`);
        const text = await response.text();
        
        // Parse CSV
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        
        // Filter records for this user with timestamp <= current time
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
            }
        }
        
        // Get last 5 records
        records.push(...userRecords.slice(-5));

    } catch (error) {
        console.error(`Error fetching data for user ${userId}:`, error);
    }

    return records;
}

/**
 * Send data to API endpoint and return parsed response
 * @param {Array} records - Array of user records
 * @returns {Promise<Array>} Parsed API response array
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
        const response = await fetch(API_URL, requestOptions);
        const resultText = await response.text();
        console.log('API Response:', resultText);
        
        // Parse JSON response
        const parsedResult = JSON.parse(resultText);
        return parsedResult;
    } catch (error) {
        console.error('API Error:', error.message);
        throw error;
    }
}

/**
 * Collect and send last 5 records for all users
 */
async function collectAndSendAllUsers() {
    console.log('=== COLLECTING DATA FOR ALL USERS ===');
    
    const statusElement = document.getElementById('api-status');
    if (statusElement) {
        statusElement.textContent = 'Sending data...';
        statusElement.style.color = '#ff9800';
    }
    
    let totalRecordsSent = 0;
    let successCount = 0;
    let failCount = 0;
    
    try {
        // Process each user
        for (const user of USERS) {
            try {
                console.log(`Collecting records for User ${user.id}...`);
                
                // Collect last 5 records for this user
                const records = await getLast5Records(user.id);
                
                console.log(`User ${user.id}: Found ${records.length} records`);
                
                if (records.length > 0) {
                    // Send to API and get response
                    const apiResponse = await sendToAPI(records);
                    totalRecordsSent += records.length;
                    successCount++;
                    console.log(`User ${user.id}: Successfully sent ${records.length} records`);
                    
                    // Process API response to update user health status
                    if (apiResponse && apiResponse.length > 0) {
                        // Get the latest record from the response (last item)
                        const latestRecord = apiResponse[apiResponse.length - 1];
                        
                        // Extract rule_match_any and timestamp
                        const ruleMatchAny = latestRecord.rule_match_any || 0;
                        const timestamp = latestRecord.timestamp;
                        
                        // Format timestamp
                        const time = new Date(timestamp);
                        const timeStr = time.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });
                        
                        // Update stored health status
                        userHealthStatus[user.id] = {
                            status: ruleMatchAny === 0 ? 'healthy' : 'abnormal',
                            lastUpdate: timeStr,
                            ruleMatchAny: ruleMatchAny,
                            ruleName: latestRecord.rule_name,
                            ruleScore: latestRecord.rule_score
                        };
                        
                        console.log(`User ${user.id} status: ${userHealthStatus[user.id].status} (rule_match_any=${ruleMatchAny})`);
                    }
                } else {
                    console.warn(`User ${user.id}: No records found`);
                    userHealthStatus[user.id] = {
                        status: 'healthy',
                        lastUpdate: 'No data',
                        ruleMatchAny: 0
                    };
                }
                
            } catch (error) {
                failCount++;
                console.error(`User ${user.id}: Error sending data:`, error);
                // Keep previous status or set to error
                if (!userHealthStatus[user.id] || userHealthStatus[user.id].status === 'loading') {
                    userHealthStatus[user.id] = {
                        status: 'healthy',
                        lastUpdate: 'Error',
                        ruleMatchAny: null
                    };
                }
            }
        }
        
        // Update the table with new health status
        renderUserTable();
        
        // Update status display
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
        
        if (statusElement) {
            if (failCount === 0) {
                statusElement.textContent = `Last updated: ${timeStr}`;
                statusElement.style.color = '#4caf50';
            } else {
                statusElement.textContent = `Last updated: ${timeStr}`;
                statusElement.style.color = '#ff9800';
            }
        }
        
        console.log(`=== COMPLETED: ${successCount} users succeeded, ${failCount} failed, ${totalRecordsSent} total records sent ===`);
        
    } catch (error) {
        console.error('=== ERROR IN COLLECT AND SEND ALL USERS ===');
        console.error('Error:', error);
        if (statusElement) {
            statusElement.textContent = `API Error: ${error.message}`;
            statusElement.style.color = '#f44336';
        }
    }
}

/**
 * Start automatic data sending every 2 minutes for all users
 */
function startAutoSendAPI() {
    console.log('Starting automatic API data sending for all users (every 2 minutes)...');
    
    // Clear any existing interval first
    if (apiInterval) {
        clearInterval(apiInterval);
        apiInterval = null;
    }
    
    // Send immediately on start
    collectAndSendAllUsers();
    
    // Then send every 2 minutes
    apiInterval = setInterval(collectAndSendAllUsers, SEND_INTERVAL);
}

/**
 * Stop automatic data sending
 */
function stopAutoSendAPI() {
    if (apiInterval) {
        clearInterval(apiInterval);
        apiInterval = null;
        console.log('Stopped automatic API data sending');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Update time display
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000); // Update every second
    
    // Load user data
    renderUserTable();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Start API auto-send for all users
    console.log('=== HOMEPAGE LOADED - STARTING API AUTO-SEND ===');
    startAutoSendAPI();
});
