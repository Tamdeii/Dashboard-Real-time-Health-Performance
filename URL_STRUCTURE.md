# ✅ WebDashBoard URL Structure & Logic

## 📁 File Structure
```
/webDashBoard/
├── pages/
│   ├── index.html              ← Home page (patient list)
│   └── D3Visualization.html    ← Dashboard (charts)
├── css/
│   ├── home.css               ← Styling for home page
│   └── D3Visualization.css    ← Styling for dashboard
├── dataset2/                   ← CSV data files
│   ├── user_1/
│   ├── user_2/
│   ├── user_3/
│   ├── user_4/
│   └── user_5/
├── home.js                     ← Logic for home page
└── D3Visualization.js          ← Logic for dashboard
```

## 🔗 URL Paths Reference

### HTML Files (in /pages/)
- **index.html**
  - CSS link: `../css/home.css`
  - JS link: `../home.js`
  - Navigation: `D3Visualization.html?user=${user}&date=${date}`

- **D3Visualization.html**
  - CSS link: `../css/D3Visualization.css`
  - JS link: `../D3Visualization.js`
  - Home button: `index.html`

### JavaScript Files (in root)
- **home.js**
  - Data fetch: `../dataset2/${userFolder}/${csvFile}`
  
- **D3Visualization.js**
  - Data fetch: `../dataset2/${SELECTED_USER}/*.csv`

## 🌐 Access URLs
- **Home Page**: http://localhost:8000/pages/index.html
- **Dashboard**: http://localhost:8000/pages/D3Visualization.html?user=user_1&date=2025-11-09

## 🔄 Navigation Flow
1. User opens `/pages/index.html`
2. `home.js` loads from root using `../home.js`
3. `home.js` fetches CSV data using `../dataset2/user_X/*.csv`
4. User clicks "View Details" → navigates to `D3Visualization.html?user=X&date=Y`
5. `D3Visualization.js` loads from root using `../D3Visualization.js`
6. `D3Visualization.js` fetches CSV data using `../dataset2/user_X/*.csv`
7. User clicks "← " (Home button) → navigates back to `index.html`

## ✅ All Paths Verified
- ✅ CSS files load correctly from `/css/`
- ✅ JS files load correctly from root
- ✅ Dataset files load correctly from `/dataset2/`
- ✅ Navigation between pages works
- ✅ No 404 errors

## 🔧 Key Points
- HTML files are in `/pages/` folder
- CSS files are in `/css/` folder
- JS files are in root directory
- Dataset files are in `/dataset2/` folder
- All relative paths use `../` to go up one level from `/pages/`
