// Configuration
const USERS = [
    { id: 1, name: 'Kishan jun', folder: 'user_1' },
    { id: 2, name: 'Isabella Park', folder: 'user_2' },
    { id: 3, name: 'Hong Lee', folder: 'user_3' },
    { id: 4, name: 'Chang Kim', folder: 'user_4' },
    { id: 5, name: 'Jung Park', folder: 'user_5' }
];

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

// Check if user has abnormal vitals today
async function checkUserHealth(userFolder) {
    try {
        const todayDate = getTodayDate();
        const csvFiles = ['bp.csv', 'hr.csv', 'hrv.csv', 'rr.csv', 'spo2.csv', 'temp.csv'];
        
        let hasAbnormal = false;
        let latestTimestamp = null;
        let dataCount = 0;
        
        // Check all CSV files for abnormal values
        for (const csvFile of csvFiles) {
            try {
                const response = await fetch(`../dataset2/${userFolder}/${csvFile}`);
                const text = await response.text();
                const lines = text.trim().split('\n');
                
                // Skip header, process data lines
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.includes(todayDate)) continue;
                    
                    dataCount++;
                    const columns = line.split(',');
                    const timestamp = columns[0];
                    const abnormal = parseInt(columns[2]); // abnormal column
                    
                    // Update latest timestamp
                    const currentTime = new Date(timestamp);
                    if (!latestTimestamp || currentTime > latestTimestamp) {
                        latestTimestamp = currentTime;
                    }
                    
                    // Check if abnormal
                    if (abnormal === 1) {
                        hasAbnormal = true;
                    }
                }
            } catch (err) {
                console.error(`Error reading ${csvFile} for ${userFolder}:`, err);
            }
        }
        
        // Format last update time
        let lastUpdateStr = 'No data today';
        if (latestTimestamp) {
            lastUpdateStr = latestTimestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
        
        return {
            status: hasAbnormal ? 'abnormal' : 'healthy',
            lastUpdate: lastUpdateStr,
            hasData: dataCount > 0
        };
        
    } catch (error) {
        console.error(`Error checking health for ${userFolder}:`, error);
        return {
            status: 'abnormal',
            lastUpdate: 'Error loading data',
            hasData: false
        };
    }
}

// Render user table
async function renderUserTable() {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading user data...</td></tr>';
    
    const rows = [];
    
    // Load all user data in parallel
    const healthPromises = USERS.map(user => checkUserHealth(user.folder));
    const healthResults = await Promise.all(healthPromises);
    
    // Create table rows
    USERS.forEach((user, index) => {
        const health = healthResults[index];
        
        const statusText = health.status === 'healthy' ? 'Normal' : 'Abnormal';
        
        const row = `
            <tr>
                <td class="user-id">User ${user.id}</td>
                <td class="patient-name">${user.name}</td>
                <td>
                    <span style="font-weight: 600; color: ${health.status === 'healthy' ? '#4caf50' : '#f44336'}">
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

// Auto-refresh every 5 minutes
function startAutoRefresh() {
    setInterval(() => {
        console.log('Auto-refreshing user status...');
        renderUserTable();
    }, 300000); // 5 minutes
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
});
