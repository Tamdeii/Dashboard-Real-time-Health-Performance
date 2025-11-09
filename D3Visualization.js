
// Configuration
// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
let SELECTED_USER = urlParams.get('user') || 'user_1';

// Set TARGET_DATE from URL or default to today's date
const initialDate = new Date();
const year = initialDate.getFullYear();
const month = String(initialDate.getMonth() + 1).padStart(2, '0');
const day = String(initialDate.getDate()).padStart(2, '0');
let TARGET_DATE = urlParams.get('date') || `${year}-${month}-${day}`;

// Real-time variables
let allData = {}; // Store all loaded data
let updateInterval = null; // Store interval ID for auto-refresh

// Chart dimensions
const margin = { top: 10, right: 80, bottom: 25, left: 60 };
const width = 1000 - margin.left - margin.right;
const height = 300 - margin.top - margin.bottom;

// Create a line chart from CSV data
function createLineChart(data, containerId, color = 'blue') {
    const container = d3.select(`#${containerId}`);
    container.html(''); // Clear loading message
    
    if (!Array.isArray(data)) {
        container.text('Invalid data format');
        return;
    }

    if (data.length === 0) {
        container.text('No data available');
        return;
    }

    // Get column names
    const columns = Object.keys(data[0]);
    console.log(`${containerId} columns:`, columns);
    
    // Find timestamp column (might be first or second column depending on file format)
    const timestampKey = columns.find(col => col.toLowerCase().includes('timestamp')) || columns[0];
    // Rest are values (excluding timestamp and user_id if present)
    const valueKeys = columns.filter(col => col !== timestampKey && col !== 'user_id');
    
    // Parse data with actual timestamps from CSV
    data.forEach((d, i) => {
        d.index = i;
        // Parse the timestamp from CSV (keep the real time)
        d.time = new Date(d[timestampKey]);
        // Keep original timestamp string for filtering
        d.timestampStr = d[timestampKey];
        
        // Convert numeric values
        valueKeys.forEach(key => {
            d[key] = +d[key];
        });
    });
    
    data = data.filter(d => {
        // Check if timestamp string starts with target date
        return d.timestampStr.startsWith(TARGET_DATE);
    });

    if (data.length === 0) {
        container.text(`No data available for ${TARGET_DATE}`);
        return;
    }

    console.log(`${containerId} filtered data points for ${TARGET_DATE}:`, data.length);

    // Create SVG
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get the actual date from data and set range based on last data point
    const dataDate = data[0].time;
    const startOfDay = new Date(dataDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Use the last data point's time as the end of the chart
    const lastDataTime = data[data.length - 1].time;
    
    // Create scales
    // x scale - time scale from start of day to last data point
    const x = d3.scaleTime()
        .domain([startOfDay, lastDataTime])
        .range([0, width]);    // y scale - exclude binary columns (asleep, abnormal) from domain calculation
    const numericKeys = valueKeys.filter(key => key !== 'asleep' && key !== 'abnormal');
    
    // Get the range for numeric data
    const numericMin = d3.min(data, d => d3.min(numericKeys, key => d[key]));
    const numericMax = d3.max(data, d => d3.max(numericKeys, key => d[key]));
    
    // Extend domain to include 0 and 1 for binary indicators
    // to make sure both abnormal and asleep (0/1) are visible
    const y = d3.scaleLinear()
        .domain([
            Math.min(0, numericMin),  // Include 0 for binary indicators
            Math.max(1, numericMax)   // Include 1 for binary indicators
        ])
        .nice()
        .range([height, 0]);

    // Create grid
    svg.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.3)
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat(''));

    // Create axes with time format
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .ticks(d3.timeHour.every(2))  // Show tick every 2 hours
            .tickFormat(d3.timeFormat('%H:%M')));  // Format as HH:MM

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y));

    // Color scale for multiple lines
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#b51a1aff', '#9467bd', '#7a463bff'];
    const colorScale = d3.scaleOrdinal()
        .domain(valueKeys)
        .range(colors);

    // Create line generator with time scale
    const line = d3.line()
        .x((d, i) => x(data[i].time))
        .y(d => y(d));

    // Draw lines for each value column with animation
    valueKeys.forEach(key => {
        // Draw all lines using the same scale (binary values will show as 0 or 1)
        const path = svg.append('path')
            .datum(data.map(d => d[key]))
            .attr('class', 'line')
            .attr('d', line)
            .attr('stroke', colorScale(key))
            .attr('stroke-width', 2)
            .attr('fill', 'none');

        // Get the total length of the path for animation
        const totalLength = path.node().getTotalLength();

        // Set up the animation: start with the line hidden
        path
            .attr('stroke-dasharray', totalLength + ' ' + totalLength)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(2000) // 2 seconds animation
            .ease(d3.easeLinear)
            .attr('stroke-dashoffset', 0);

        // Add legend with fade-in effect
        svg.append('text')
            .attr('x', width + 10)
            .attr('y', valueKeys.indexOf(key) * 20)
            .attr('fill', colorScale(key))
            .attr('class', 'legend-text')
            .attr('opacity', 0)
            .text(key)
            .transition()
            .duration(500)
            .delay(1500) // Start fading in near the end of line animation
            .attr('opacity', 1);
    });

    // Add axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
        .attr('text-anchor', 'middle')
        .attr('class', 'axis-label')
        .text('Time');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .attr('class', 'axis-label')
        .text('Value');

    // Add data count and date info
    const displayDate = new Date(TARGET_DATE + 'T12:00:00');
    const dateFormatter = d3.timeFormat('%B %d, %Y');
    
    container.append('p')
        .attr('class', 'data-count')
        .text(`Total data points: ${data.length}`);
    
    container.append('p')
        .attr('class', 'date-display')
        .text(`Date: ${dateFormatter(displayDate)}`);
}

// Function to handle errors
function handleError(containerId, error) {
    d3.select(`#${containerId}`)
        .html('')
        .append('p')
        .attr('class', 'error')
        .text(`Error loading data: ${error.message}`);
}

// Load all CSV files and create line charts
function loadDatasets() {
    const datasets = [
        { file: `../dataset2/${SELECTED_USER}/bp.csv`, containerId: 'bp-chart', name: 'BP', color: '#e74c3c' },
        { file: `../dataset2/${SELECTED_USER}/hr.csv`, containerId: 'hr-chart', name: 'HR', color: '#2473a7ff' },
        { file: `../dataset2/${SELECTED_USER}/hrv.csv`, containerId: 'hrv-chart', name: 'HRV', color: '#23a459ff' },
        { file: `../dataset2/${SELECTED_USER}/rr.csv`, containerId: 'rr-chart', name: 'RR', color: '#f39c12' },
        { file: `../dataset2/${SELECTED_USER}/spo2.csv`, containerId: 'spo2-chart', name: 'SpO2', color: '#9b59b6' },
        { file: `../dataset2/${SELECTED_USER}/temp.csv`, containerId: 'temp-chart', name: 'Temperature', color: '#e67e22' }
    ];

    // Clear existing charts
    datasets.forEach(dataset => {
        d3.select(`#${dataset.containerId}`).html('Loading...');
    });
    
    allData = {};

    // Load all datasets
    const loadPromises = datasets.map(dataset => 
        d3.csv(dataset.file)
            .then(data => {
                console.log(`${dataset.name} loaded: ${data.length} rows`);
                // Display all data from CSV directly
                createLineChart(data, dataset.containerId, dataset.color);
            })
            .catch(error => {
                console.error(`Error loading ${dataset.name}:`, error);
                handleError(dataset.containerId, error);
            })
    );

    Promise.all(loadPromises).then(() => {
        console.log('All data loaded and displayed');
    });
}

// Event listeners
document.getElementById('load-btn').addEventListener('click', () => {
    // Get user from URL parameters (user is no longer selectable via dropdown)
    const urlParams = new URLSearchParams(window.location.search);
    SELECTED_USER = urlParams.get('user') || 'user_1';
    TARGET_DATE = document.getElementById('date-input').value;
    console.log(`Loading data for ${SELECTED_USER} on ${TARGET_DATE}`);
    
    // Clear existing interval if any
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    // Load data immediately
    loadDatasets();
    
    // Set up auto-refresh every 5 minutes (300000ms) if viewing today
    const targetDate = new Date(TARGET_DATE + 'T00:00:00');
    const today = new Date();
    
    if (targetDate.getFullYear() === today.getFullYear() &&
        targetDate.getMonth() === today.getMonth() &&
        targetDate.getDate() === today.getDate()) {
        
        console.log('Setting up auto-refresh for today\'s data (every 5 minutes)');
        updateInterval = setInterval(() => {
            console.log('Auto-refreshing data...');
            loadDatasets();
        }, 300000); // 5 minutes = 300,000ms
    }
});

// Set the date input from URL parameters or defaults
document.getElementById('date-input').value = TARGET_DATE;

// Load initial data automatically
loadDatasets();

// Set up initial auto-refresh if default date is today
const defaultDate = new Date(TARGET_DATE + 'T00:00:00');
const today = new Date();
if (defaultDate.getFullYear() === today.getFullYear() &&
    defaultDate.getMonth() === today.getMonth() &&
    defaultDate.getDate() === today.getDate()) {
    
    console.log('Initial auto-refresh setup for today\'s data');
    updateInterval = setInterval(() => {
        console.log('Auto-refreshing data...');
        loadDatasets();
    }, 300000); // 5 minutes
}

