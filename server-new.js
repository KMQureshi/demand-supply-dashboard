// ===================================================
// DEMAND-SUPPLY DASHBOARD BACKEND - VERCEL DEPLOYMENT
// ===================================================

// Vercel requires this to be at the TOP
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const schedule = require('node-schedule');
require('dotenv').config();

const app = express();

// ✅ FIX 1: PORT for Vercel - REMOVE ALL OTHER PORT DECLARATIONS
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`;

// Try to load PDF dependencies with fallback
let PDFDocument, moment;
try {
  PDFDocument = require('pdfkit');
  moment = require('moment');
  console.log('✅ PDF dependencies loaded successfully');
} catch (error) {
  console.warn('⚠️ PDF dependencies not found. Please run: npm install pdfkit moment');
  console.warn('PDF report generation will be disabled until dependencies are installed.');
}

// Enhanced CORS configuration for Vercel
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.FRONTEND_URL, 
        'https://demand-supply-app.vercel.app',
        'https://demand-supply-dashboard.vercel.app',
        'http://localhost:3000'
      ]
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Create necessary directories
const createDirectories = () => {
  const directories = [
    path.join(__dirname, 'reports'),
    path.join(__dirname, 'data'),
    path.join(__dirname, 'sessions')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

createDirectories();

// Database file (moved to data folder for better organization)
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// WhatsApp configuration
const WHATSAPP_CONFIG = {
  groupName: process.env.WHATSAPP_GROUP_NAME || "BB-Demand & Supply",
  sessionName: process.env.WHATSAPP_SESSION_NAME || 'demand-supply-session-online'
};

// WhatsApp Client
let whatsappClient = null;
let isWhatsAppReady = false;
let qrCode = null;
let qrCodeImageUrl = null;
let targetGroupId = null;
let groupSearchAttempts = 0;
const MAX_GROUP_SEARCH_ATTEMPTS = 5;

// Daily report scheduler
let dailyReportJob = null;
let reportSchedule = {
  enabled: true,
  hour: 15, // 3 PM
  minute: 0,
  sendPDF: true,
  sendSummary: true,
  lastRun: null,
  nextRun: null
};

// Helper function to extract username (requirement 1)
function extractUsername(fullUsername) {
  if (!fullUsername) return 'User';
  
  // Split by dot and take first part
  const parts = fullUsername.toString().split('.');
  return parts[0] || fullUsername;
}

// Helper function to format date for display
function formatDateForDisplay(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}

// Helper function to format time for display
function formatTimeForDisplay(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return '';
  }
}

// Helper function to get today's date string for reports
function getTodayDateString() {
  const today = new Date();
  return today.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to generate daily report statistics
function generateDailyReportStats() {
  const db = readDB();
  const demands = db.demands || [];
  
  if (demands.length === 0) {
    return {
      total: 0,
      pending: 0,
      supplied: 0,
      delayed: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      todayDemands: 0,
      last7DaysDemands: 0
    };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  
  // Calculate statistics
  const total = demands.length;
  const pending = demands.filter(d => d.status === 'Pending').length;
  const supplied = demands.filter(d => d.status === 'Supplied').length;
  const delayed = demands.filter(d => d.status === 'Delayed').length;
  const highPriority = demands.filter(d => d.priority === 'High').length;
  const mediumPriority = demands.filter(d => d.priority === 'Medium').length;
  const lowPriority = demands.filter(d => d.priority === 'Low').length;
  
  // Count today's demands
  const todayDemands = demands.filter(d => {
    try {
      const demandDate = new Date(d.created_at);
      demandDate.setHours(0, 0, 0, 0);
      return demandDate.getTime() === today.getTime();
    } catch (e) {
      return false;
    }
  }).length;
  
  // Count last 7 days demands
  const last7DaysDemands = demands.filter(d => {
    try {
      const demandDate = new Date(d.created_at);
      return demandDate >= sevenDaysAgo;
    } catch (e) {
      return false;
    }
  }).length;
  
  // Calculate total quantities
  const totalDemanded = demands.reduce((sum, d) => sum + (parseInt(d.demanded_qty) || 0), 0);
  const totalSupplied = demands.reduce((sum, d) => sum + (parseInt(d.supplied_qty) || 0), 0);
  const totalPendingQty = totalDemanded - totalSupplied;
  
  // Get recent demands (last 10)
  const recentDemands = demands.slice(-10).reverse();
  
  // Get high priority pending demands
  const highPriorityPending = demands.filter(d => 
    d.priority === 'High' && 
    d.status === 'Pending' &&
    (parseInt(d.pending_qty) || 0) > 0
  ).slice(0, 10); // Limit to 10
  
  // Get projects statistics
  const projects = {};
  demands.forEach(d => {
    if (d.project) {
      if (!projects[d.project]) {
        projects[d.project] = { total: 0, supplied: 0, pending: 0, delayed: 0, highPriority: 0 };
      }
      projects[d.project].total++;
      if (d.status === 'Supplied') projects[d.project].supplied++;
      if (d.status === 'Pending') projects[d.project].pending++;
      if (d.status === 'Delayed') projects[d.project].delayed++;
      if (d.priority === 'High') projects[d.project].highPriority++;
    }
  });
  
  // Get monthly trends (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const monthlyTrends = {};
  demands.forEach(d => {
    try {
      const date = new Date(d.created_at);
      if (date >= sixMonthsAgo) {
        const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
        if (!monthlyTrends[monthYear]) {
          monthlyTrends[monthYear] = { 
            month: date.toLocaleString('default', { month: 'short' }), 
            year: date.getFullYear(), 
            count: 0 
          };
        }
        monthlyTrends[monthYear].count++;
      }
    } catch (e) {
      // Skip invalid dates
    }
  });
  
  // Sort monthly trends
  const sortedMonthlyTrends = Object.values(monthlyTrends)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const monthA = new Date(`${a.month} 1, 2000`).getMonth();
      const monthB = new Date(`${b.month} 1, 2000`).getMonth();
      return monthA - monthB;
    });
  
  return {
    total,
    pending,
    supplied,
    delayed,
    highPriority,
    mediumPriority,
    lowPriority,
    todayDemands,
    last7DaysDemands,
    totalDemanded,
    totalSupplied,
    totalPendingQty,
    recentDemands: recentDemands,
    highPriorityPending,
    projects: Object.keys(projects).map(project => ({
      name: project,
      ...projects[project]
    })),
    monthlyTrends: sortedMonthlyTrends,
    generatedAt: new Date().toISOString()
  };
}

// Function to generate PDF report (with dependency check)
function generatePDFReport(stats) {
  return new Promise((resolve, reject) => {
    // Check if PDF dependencies are available
    if (!PDFDocument || !moment) {
      const error = new Error('PDF dependencies not installed. Run: npm install pdfkit moment');
      return reject(error);
    }
    
    try {
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `Demand_Supply_Report_${timestamp}.pdf`;
      const filepath = path.join(__dirname, 'reports', filename);
      
      // Create PDF document
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Demand-Supply Daily Report',
          Author: 'Demand-Supply Dashboard v8.8',
          Subject: 'Daily Summary Report',
          Keywords: 'demand, supply, construction, daily report',
          CreationDate: new Date()
        }
      });
      
      // Pipe to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      // Header
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor('#2c3e50')
         .text('DEMAND-SUPPLY DAILY REPORT', { align: 'center' });
      
      doc.moveDown(0.5);
      
      // Report details
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#7f8c8d')
         .text(`Generated on: ${getTodayDateString()}`, { align: 'center' });
      
      doc.text(`Time: ${formatTimeForDisplay(new Date().toISOString())}`, { align: 'center' });
      
      doc.moveDown();
      
      // Summary Statistics Box
      doc.rect(50, doc.y, 500, 80)
         .fillAndStroke('#f8f9fa', '#3498db');
      
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .fillColor('#2c3e50')
         .text('EXECUTIVE SUMMARY', 60, doc.y + 15);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#34495e');
      
      const summaryX = 60;
      const summaryY = doc.y + 15;
      
      // Left column
      doc.text(`Total Demands: ${stats.total}`, summaryX, summaryY + 25);
      doc.text(`Today's New Demands: ${stats.todayDemands}`, summaryX, summaryY + 40);
      doc.text(`Last 7 Days: ${stats.last7DaysDemands}`, summaryX, summaryY + 55);
      
      // Right column
      const rightColumnX = 300;
      doc.text(`Supplied: ${stats.supplied}`, rightColumnX, summaryY + 25);
      doc.text(`Pending: ${stats.pending}`, rightColumnX, summaryY + 40);
      doc.text(`Delayed: ${stats.delayed}`, rightColumnX, summaryY + 55);
      
      doc.moveDown(2);
      
      // Status Distribution Section
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#2c3e50')
         .text('STATUS DISTRIBUTION');
      
      doc.moveDown(0.5);
      
      // Status table
      const statusHeaders = ['Status', 'Count', 'Percentage', 'Bar'];
      const statusData = [
        ['Supplied', stats.supplied, `${Math.round((stats.supplied / stats.total) * 100) || 0}%`, '█'.repeat(Math.round((stats.supplied / stats.total) * 10))],
        ['Pending', stats.pending, `${Math.round((stats.pending / stats.total) * 100) || 0}%`, '█'.repeat(Math.round((stats.pending / stats.total) * 10))],
        ['Delayed', stats.delayed, `${Math.round((stats.delayed / stats.total) * 100) || 0}%`, '█'.repeat(Math.round((stats.delayed / stats.total) * 10))]
      ];
      
      drawTable(doc, statusHeaders, statusData, [120, 80, 100, 150]);
      
      doc.moveDown();
      
      // Priority Distribution Section
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#2c3e50')
         .text('PRIORITY DISTRIBUTION');
      
      doc.moveDown(0.5);
      
      // Priority table
      const priorityHeaders = ['Priority', 'Count', 'Percentage', 'Visual'];
      const priorityData = [
        ['🔴 High', stats.highPriority, `${Math.round((stats.highPriority / stats.total) * 100) || 0}%`, '█'.repeat(Math.round((stats.highPriority / stats.total) * 10))],
        ['🟡 Medium', stats.mediumPriority, `${Math.round((stats.mediumPriority / stats.total) * 100) || 0}%`, '█'.repeat(Math.round((stats.mediumPriority / stats.total) * 10))],
        ['🟢 Low', stats.lowPriority, `${Math.round((stats.lowPriority / stats.total) * 100) || 0}%`, '█'.repeat(Math.round((stats.lowPriority / stats.total) * 10))]
      ];
      
      drawTable(doc, priorityHeaders, priorityData, [120, 80, 100, 150]);
      
      doc.moveDown();
      
      // Project-wise Summary Section
      if (stats.projects && stats.projects.length > 0) {
        doc.addPage();
        
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#2c3e50')
           .text('PROJECT-WISE SUMMARY', { align: 'center' });
        
        doc.moveDown();
        
        const projectHeaders = ['Project', 'Total', 'Supplied', 'Pending', 'Delayed', 'High Priority'];
        const projectData = stats.projects.map(project => [
          project.name,
          project.total.toString(),
          project.supplied.toString(),
          project.pending.toString(),
          project.delayed.toString(),
          project.highPriority.toString()
        ]);
        
        drawTable(doc, projectHeaders, projectData, [120, 60, 60, 60, 60, 80]);
      }
      
      // High Priority Pending Items Section
      if (stats.highPriorityPending && stats.highPriorityPending.length > 0) {
        doc.addPage();
        
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#e74c3c')
           .text('🚨 URGENT ATTENTION REQUIRED', { align: 'center' });
        
        doc.moveDown();
        
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor('#2c3e50')
           .text('HIGH PRIORITY PENDING ITEMS');
        
        doc.moveDown(0.5);
        
        const urgentHeaders = ['#', 'Item', 'Demand No', 'Project', 'Pending Qty', 'Due Date'];
        const urgentData = stats.highPriorityPending.map((demand, index) => [
          (index + 1).toString(),
          demand.item.substring(0, 30),
          demand.demand_no,
          demand.project,
          demand.pending_qty.toString(),
          formatDateForDisplay(demand.due_date)
        ]);
        
        drawTable(doc, urgentHeaders, urgentData, [30, 150, 80, 80, 80, 100]);
      }
      
      // Recent Demands Section
      if (stats.recentDemands && stats.recentDemands.length > 0) {
        doc.addPage();
        
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#2c3e50')
           .text('RECENT DEMANDS (Last 10)', { align: 'center' });
        
        doc.moveDown();
        
        const recentHeaders = ['Item', 'Demand No', 'Project', 'Status', 'Priority', 'Created'];
        const recentData = stats.recentDemands.map(demand => [
          demand.item.substring(0, 30),
          demand.demand_no,
          demand.project,
          demand.status,
          demand.priority,
          formatDateForDisplay(demand.created_at)
        ]);
        
        drawTable(doc, recentHeaders, recentData, [150, 80, 80, 60, 60, 100]);
      }
      
      // Summary and Recommendations Page
      doc.addPage();
      
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .fillColor('#2c3e50')
         .text('SUMMARY & RECOMMENDATIONS', { align: 'center' });
      
      doc.moveDown();
      
      // Summary Box
      doc.rect(50, doc.y, 500, 100)
         .fillAndStroke('#f8f9fa', '#2ecc71');
      
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#27ae60')
         .text('KEY FINDINGS', 60, doc.y + 15);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#34495e');
      
      const findingsY = doc.y + 15;
      let findingsOffset = 30;
      
      if (stats.total > 0) {
        const completionRate = Math.round((stats.supplied / stats.total) * 100);
        doc.text(`• Overall Completion Rate: ${completionRate}%`, 60, findingsY + findingsOffset);
        findingsOffset += 15;
        
        if (stats.highPriorityPending.length > 0) {
          doc.text(`• ${stats.highPriorityPending.length} high priority items need immediate attention`, 60, findingsY + findingsOffset);
          findingsOffset += 15;
        }
        
        if (stats.delayed > 0) {
          doc.text(`• ${stats.delayed} items are delayed and require escalation`, 60, findingsY + findingsOffset);
          findingsOffset += 15;
        }
        
        if (stats.todayDemands > 0) {
          doc.text(`• ${stats.todayDemands} new demands added today`, 60, findingsY + findingsOffset);
          findingsOffset += 15;
        }
      }
      
      doc.moveDown(3);
      
      // Recommendations
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#e67e22')
         .text('RECOMMENDATIONS');
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#34495e');
      
      let recOffset = 0;
      const recommendations = [
        "1. Focus on high priority pending items first",
        "2. Follow up on delayed items immediately",
        "3. Update supply status daily for accurate tracking",
        "4. Review project-wise performance regularly",
        "5. Plan procurement based on pending demands",
        "6. Communicate delays to relevant stakeholders promptly"
      ];
      
      recommendations.forEach(rec => {
        doc.text(rec, 60, doc.y + recOffset);
        recOffset += 15;
      });
      
      doc.moveDown(2);
      
      // Footer
      doc.font('Helvetica-Oblique')
         .fontSize(8)
         .fillColor('#7f8c8d')
         .text('Generated by Demand-Supply Dashboard v8.8', 50, doc.page.height - 50, {
           align: 'center',
           width: 500
         });
      
      doc.text(`Report ID: ${timestamp}`, 50, doc.page.height - 35, {
        align: 'center',
        width: 500
      });
      
      // Finalize PDF
      doc.end();
      
      stream.on('finish', () => {
        console.log(`✅ PDF report generated: ${filename}`);
        resolve({
          filename: filename,
          filepath: filepath,
          url: `${BASE_URL}/reports/${filename}`,
          timestamp: timestamp
        });
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to draw tables in PDF
function drawTable(doc, headers, data, columnWidths) {
  const startX = 50;
  const startY = doc.y;
  const rowHeight = 25;
  const headerHeight = 30;
  
  // Draw header
  doc.rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), headerHeight)
     .fillAndStroke('#3498db', '#2980b9');
  
  let currentX = startX;
  headers.forEach((header, i) => {
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#ffffff')
       .text(header, currentX + 5, startY + 8, {
         width: columnWidths[i] - 10,
         align: 'center'
       });
    currentX += columnWidths[i];
  });
  
  // Draw data rows
  data.forEach((row, rowIndex) => {
    const rowY = startY + headerHeight + (rowIndex * rowHeight);
    
    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.rect(startX, rowY, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
         .fill('#f8f9fa');
    }
    
    currentX = startX;
    row.forEach((cell, cellIndex) => {
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#2c3e50')
         .text(cell, currentX + 5, rowY + 8, {
           width: columnWidths[cellIndex] - 10,
           align: cellIndex === 0 ? 'left' : 'center'
         });
      
      // Draw vertical line
      doc.rect(currentX + columnWidths[cellIndex], rowY, 0.5, rowHeight)
         .stroke('#bdc3c7');
      
      currentX += columnWidths[cellIndex];
    });
    
    // Draw horizontal line
    doc.rect(startX, rowY + rowHeight, columnWidths.reduce((a, b) => a + b, 0), 0.5)
       .stroke('#bdc3c7');
  });
  
  // Draw outer border
  doc.rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), 
          headerHeight + (data.length * rowHeight))
     .stroke('#2c3e50');
  
  // Update Y position
  doc.y = startY + headerHeight + (data.length * rowHeight) + 20;
}

// SIMPLIFIED: Helper function to create very short summary message for WhatsApp
function createShortSummaryMessage(stats, pdfInfo = {}) {
  const today = getTodayDateString();
  
  if (stats.total === 0) {
    return `📊 *Demand-Supply Report*
━━━━━━━━━━━━━━━━━━━━
📅 ${today}
🕒 ${formatTimeForDisplay(new Date().toISOString())}
━━━━━━━━━━━━━━━━━━━━
No demands in the system yet.
━━━━━━━━━━━━━━━━━━━━
📊 Dashboard: ${BASE_URL}
🔧 v8.8`;
  }
  
  // Calculate completion rate
  const completionRate = stats.total > 0 ? Math.round((stats.supplied / stats.total) * 100) : 0;
  
  let message = `📊 *Demand-Supply Report*
━━━━━━━━━━━━━━━━━━━━
📅 ${today}
🕒 ${formatTimeForDisplay(new Date().toISOString())}
━━━━━━━━━━━━━━━━━━━━
📈 *Summary*
• Total: ${stats.total}
• Supplied: ${stats.supplied} (${completionRate}%)
• Pending: ${stats.pending}
• Delayed: ${stats.delayed}
• High Priority: ${stats.highPriority}
• Today's New: ${stats.todayDemands}`;
  
  // Add PDF info if available
  if (pdfInfo.url && !pdfInfo.error) {
    message += `
━━━━━━━━━━━━━━━━━━━━
📄 *Full Report*
Download: ${pdfInfo.url}`;
  } else if (pdfInfo.error) {
    message += `
━━━━━━━━━━━━━━━━━━━━
⚠️ PDF generation failed
Check server logs`;
  }
  
  message += `
━━━━━━━━━━━━━━━━━━━━
📊 Dashboard: ${BASE_URL}
🔧 v8.8`;
  
  return message;
}

// Helper function to format multiple demands with same demand number (requirement 2)
function formatMultipleDemandsSummary(demands) {
  if (demands.length === 0) return '';
  if (demands.length === 1) return demands[0].item;
  
  // Extract items and quantities
  const items = demands.map(d => d.item).join(', ');
  const quantities = demands.map(d => `${d.demanded_qty} ${d.unit || ''}`).join(', ');
  
  return `Items: ${items} | Quantities: ${quantities}`;
}

// Helper function to create clean demand message
function createCleanDemandMessage(demand, username) {
  const priorityIndicator = demand.priority === 'High' ? '🚨' : demand.priority === 'Medium' ? '⚠️' : 'ℹ️';
  const createdDate = formatDateForDisplay(demand.created_at);
  const dueDate = formatDateForDisplay(demand.due_date);
  
  return `📋 *NEW DEMAND*
━━━━━━━━━━━━━━━━━━━━
📦 *Item:* ${demand.item}
📊 *Quantity:* ${demand.demanded_qty} ${demand.unit || ''}
🔢 *Demand No:* ${demand.demand_no}
🏢 *Project:* ${demand.project}
${priorityIndicator} *Priority:* ${demand.priority}
📅 *Demand Raised:* ${createdDate}
⏳ *Due Date:* ${dueDate}
👤 *Raised by:* ${username}
━━━━━━━━━━━━━━━━━━━━
🕒 ${formatTimeForDisplay(demand.created_at)}`;
}

// Helper function to create clean grouped demand message
function createCleanGroupedDemandMessage(demands, demandNumber, initiatedBy, project, priority, dueDate) {
  const priorityIndicator = priority === 'High' ? '🚨' : priority === 'Medium' ? '⚠️' : 'ℹ️';
  const username = extractUsername(initiatedBy);
  const formattedDueDate = formatDateForDisplay(dueDate);
  
  if (demands.length === 1) {
    return createCleanDemandMessage(demands[0], username);
  }
  
  // Multiple demands summary - cleaner format
  const itemLines = demands.map((d, i) => {
    return `${i+1}. ${d.item} - ${d.demanded_qty} ${d.unit || ''}`;
  }).join('\n');
  
  const totalItems = demands.length;
  const totalQuantity = demands.reduce((sum, d) => sum + (parseInt(d.demanded_qty) || 0), 0);
  
  return `📋 *MULTIPLE NEW DEMANDS*
━━━━━━━━━━━━━━━━━━━━
🔢 *Demand No:* ${demandNumber}
🏢 *Project:* ${project}
${priorityIndicator} *Priority:* ${priority}
📦 *Total Items:* ${totalItems}
📊 *Total Quantity:* ${totalQuantity}
⏳ *Due Date:* ${formattedDueDate}
👤 *Raised by:* ${username}
━━━━━━━━━━━━━━━━━━━━
📋 *ITEMS DETAILS:*
${itemLines}
━━━━━━━━━━━━━━━━━━━━
🕒 ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

// Helper function to create clean supply update message
function createCleanSupplyUpdateMessage(demand, updatedBy, increase = 0) {
  const statusIndicator = demand.status === 'Supplied' ? '✅' : demand.status === 'Delayed' ? '⏱️' : '🔄';
  const username = extractUsername(updatedBy);
  const supplyUnit = demand.supply_unit || demand.unit || 'units';
  const createdDate = formatDateForDisplay(demand.created_at);
  const updatedDate = formatDateForDisplay(new Date().toISOString());
  
  let increaseText = '';
  if (increase > 0) {
    increaseText = `\n➕ *New Supply:* ${increase} ${supplyUnit}`;
  }
  
  return `📦 *SUPPLY UPDATE*
━━━━━━━━━━━━━━━━━━━━
📋 *Item:* ${demand.item}
🔢 *Demand No:* ${demand.demand_no}
🏢 *Project:* ${demand.project}
📦 *Supplied:* ${demand.supplied_qty} ${supplyUnit}${increaseText}
⏳ *Pending:* ${demand.pending_qty} ${demand.unit || ''}
${statusIndicator} *Status:* ${demand.status}
📅 *Demand Raised:* ${createdDate}
📅 *Updated on:* ${updatedDate}
👤 *Updated by:* ${username}
━━━━━━━━━━━━━━━━━━━━
🕒 ${formatTimeForDisplay(new Date().toISOString())}`;
}

// Helper function to create clean grouped supply update message
function createCleanGroupedSupplyUpdateMessage(demands, demandNumber, updatedBy) {
  const username = extractUsername(updatedBy);
  const updatedDate = formatDateForDisplay(new Date().toISOString());
  
  if (demands.length === 1) {
    return createCleanSupplyUpdateMessage(demands[0], updatedBy);
  }
  
  // Multiple demands summary for supply update - cleaner format
  const supplyLines = demands.map((d, i) => {
    const supplyUnit = d.supply_unit || d.unit || 'units';
    const statusEmoji = d.status === 'Supplied' ? '✅' : d.status === 'Delayed' ? '⏱️' : '🔄';
    return `${i+1}. ${d.item}: ${d.supplied_qty}/${d.demanded_qty} ${supplyUnit} ${statusEmoji} ${d.status}`;
  }).join('\n');
  
  const totalSupplied = demands.reduce((sum, d) => sum + (parseInt(d.supplied_qty) || 0), 0);
  const totalDemanded = demands.reduce((sum, d) => sum + (parseInt(d.demanded_qty) || 0), 0);
  const pending = totalDemanded - totalSupplied;
  
  return `📦 *MULTIPLE SUPPLY UPDATES*
━━━━━━━━━━━━━━━━━━━━
🔢 *Demand No:* ${demandNumber}
🏢 *Project:* ${demands[0]?.project || 'N/A'}
📦 *Total Supplied:* ${totalSupplied}
⏳ *Total Pending:* ${pending}
📅 *Updated on:* ${updatedDate}
👤 *Updated by:* ${username}
━━━━━━━━━━━━━━━━━━━━
📋 *ITEMS STATUS:*
${supplyLines}
━━━━━━━━━━━━━━━━━━━━
🕒 ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

// Function to send daily report (UPDATED FOR PDF)
async function sendDailyReport() {
  console.log('\n📅 GENERATING DAILY REPORT...');
  
  try {
    const stats = generateDailyReportStats();
    let results = [];
    
    // Update last run time
    reportSchedule.lastRun = new Date().toISOString();
    saveReportSchedule();
    
    // Generate PDF report if enabled
    let pdfResult = null;
    if (reportSchedule.sendPDF) {
      console.log('📄 Generating PDF report...');
      try {
        pdfResult = await generatePDFReport(stats);
        console.log(`✅ PDF generated: ${pdfResult.filename}`);
      } catch (pdfError) {
        console.error('❌ PDF generation failed:', pdfError.message);
        pdfResult = { error: pdfError.message };
      }
    }
    
    // Send ONE SINGLE MESSAGE ONLY with everything
    const summaryMessage = createShortSummaryMessage(stats, pdfResult || {});
    console.log('📋 Sending single summary message...');
    const summaryResult = await sendToWhatsAppGroup(summaryMessage, 'DAILY_REPORT');
    results.push({ type: 'summary', ...summaryResult });
    
    console.log('✅ Daily report sent successfully!');
    
    // Save report timestamp
    const db = readDB();
    db.lastDailyReport = {
      timestamp: new Date().toISOString(),
      pdfFile: pdfResult && !pdfResult.error ? pdfResult.filename : null,
      stats: stats
    };
    writeDB(db);
    
    return { 
      success: true, 
      results: results,
      stats: stats,
      pdf: pdfResult,
      schedule: reportSchedule
    };
    
  } catch (error) {
    console.error('❌ Error in daily report process:', error.message);
    return { success: false, error: error.message };
  }
}

// Function to update report schedule
function updateReportSchedule(newSchedule) {
  console.log('🔄 Updating report schedule...');
  
  // Update schedule settings
  reportSchedule = {
    ...reportSchedule,
    ...newSchedule,
    lastRun: reportSchedule.lastRun,
    nextRun: reportSchedule.nextRun
  };
  
  // Save to database
  saveReportSchedule();
  
  // Reschedule the job if enabled
  if (reportSchedule.enabled) {
    scheduleDailyReport();
  } else {
    // Cancel existing job if disabled
    if (dailyReportJob) {
      dailyReportJob.cancel();
      dailyReportJob = null;
      reportSchedule.nextRun = null;
      console.log('⏸️ Daily report scheduling disabled');
    }
  }
  
  console.log('✅ Report schedule updated:', reportSchedule);
  return reportSchedule;
}

// Save report schedule to database
function saveReportSchedule() {
  const db = readDB();
  db.reportSchedule = reportSchedule;
  writeDB(db);
}

// Load report schedule from database
function loadReportSchedule() {
  const db = readDB();
  if (db.reportSchedule) {
    reportSchedule = { ...reportSchedule, ...db.reportSchedule };
    console.log('📅 Loaded report schedule from database');
  }
}

// Schedule daily report based on current settings
function scheduleDailyReport() {
  // Cancel existing job if any
  if (dailyReportJob) {
    dailyReportJob.cancel();
    dailyReportJob = null;
  }
  
  if (!reportSchedule.enabled) {
    console.log('⏸️ Daily report scheduling is disabled');
    reportSchedule.nextRun = null;
    return;
  }
  
  // Create cron expression for the scheduled time
  const cronExpression = `${reportSchedule.minute} ${reportSchedule.hour} * * *`;
  
  // Schedule new job
  dailyReportJob = schedule.scheduleJob(cronExpression, async () => {
    console.log('⏰ Daily report scheduler triggered');
    
    if (isWhatsAppReady && targetGroupId) {
      await sendDailyReport();
    } else {
      console.log('⚠️ WhatsApp not ready, skipping daily report');
    }
  });
  
  // Update next run time
  if (dailyReportJob) {
    reportSchedule.nextRun = dailyReportJob.nextInvocation();
    saveReportSchedule();
  }
  
  console.log(`📅 Daily report scheduled for ${reportSchedule.hour}:${reportSchedule.minute.toString().padStart(2, '0')} every day`);
  console.log(`📊 Settings: PDF Report: ${reportSchedule.sendPDF ? 'Yes' : 'No'}, Summary: ${reportSchedule.sendSummary ? 'Yes' : 'No'}`);
}

// Initialize WhatsApp Client
function initializeWhatsApp() {
  console.log('🚀 Initializing WhatsApp Client...');
  
  try {
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: WHATSAPP_CONFIG.sessionName,
        dataPath: path.join(__dirname, 'sessions') // Store sessions in separate directory
      }),
      puppeteer: {
        headless: process.env.NODE_ENV === 'production' ? 'new' : true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled'
        ],
        executablePath: process.env.CHROME_PATH || // Use environment variable for production
          (process.platform === 'win32' 
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : '/usr/bin/google-chrome')
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      }
    });

    // QR Code generated
    whatsappClient.on('qr', (qr) => {
      console.log('\n📱 WHATSAPP QR CODE:');
      qrcode.generate(qr, { small: true });
      qrCode = qr;
      qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      console.log('📱 Scan QR code with WhatsApp to connect');
    });

    // WhatsApp ready
    whatsappClient.on('ready', () => {
      console.log('✅ WhatsApp Client is READY!');
      console.log('👤 Connected as:', whatsappClient.info?.pushname || 'Unknown User');
      isWhatsAppReady = true;
      qrCode = null;
      qrCodeImageUrl = null;
      groupSearchAttempts = 0;
      
      // Load saved schedule
      loadReportSchedule();
      
      // Schedule daily report based on settings
      scheduleDailyReport();
      
      // Send test notification about report schedule
      setTimeout(async () => {
        if (isWhatsAppReady && targetGroupId) {
          const scheduleStatus = reportSchedule.enabled ? 
            `enabled (${reportSchedule.hour}:${reportSchedule.minute.toString().padStart(2, '0')})` : 
            'disabled';
          
          const testMessage = `📊 *System Activated*
━━━━━━━━━━━━━━━━━━━━
✅ Daily reports: ${scheduleStatus}
📊 Dashboard: ${BASE_URL}
🔧 v8.8`;
          
          await sendToWhatsAppGroup(testMessage, 'REPORT_SYSTEM_TEST');
        }
      }, 30000); // 30 seconds after startup
      
      // Automatically search for group with retry mechanism
      setTimeout(() => {
        console.log('🔍 Automatically searching for WhatsApp group...');
        findWhatsAppGroupWithRetry();
      }, 3000);
    });

    // WhatsApp authenticated
    whatsappClient.on('authenticated', () => {
      console.log('🔐 WhatsApp authenticated');
    });

    // WhatsApp auth failure
    whatsappClient.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp auth failure:', msg);
    });

    // Message sent event
    whatsappClient.on('message_created', (message) => {
      if (message.fromMe) {
        console.log('📨 Message sent successfully');
      }
    });

    // WhatsApp disconnected
    whatsappClient.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp disconnected:', reason);
      isWhatsAppReady = false;
      targetGroupId = null;
      groupSearchAttempts = 0;
      
      // Cancel scheduled report
      if (dailyReportJob) {
        dailyReportJob.cancel();
        dailyReportJob = null;
      }
      
      // Try to reconnect after 10 seconds
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        initializeWhatsApp();
      }, 10000);
    });

    // Initialize client
    whatsappClient.initialize();

  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp:', error);
    setTimeout(initializeWhatsApp, 5000);
  }
}

// Find WhatsApp group with retry mechanism
async function findWhatsAppGroupWithRetry() {
  if (groupSearchAttempts >= MAX_GROUP_SEARCH_ATTEMPTS) {
    console.log(`❌ Max group search attempts (${MAX_GROUP_SEARCH_ATTEMPTS}) reached.`);
    console.log('💡 You can still send messages manually if you know the group ID.');
    return;
  }
  
  groupSearchAttempts++;
  console.log(`🔄 Group search attempt ${groupSearchAttempts}/${MAX_GROUP_SEARCH_ATTEMPTS}`);
  
  await findWhatsAppGroup();
  
  // If not found, retry after delay
  if (!targetGroupId && groupSearchAttempts < MAX_GROUP_SEARCH_ATTEMPTS) {
    const delay = groupSearchAttempts * 3000; // Exponential backoff: 3s, 6s, 9s, 12s
    console.log(`⏳ Retrying in ${delay/1000} seconds...`);
    setTimeout(findWhatsAppGroupWithRetry, delay);
  }
}

// Find WhatsApp group
async function findWhatsAppGroup() {
  if (!whatsappClient || !isWhatsAppReady) {
    console.log('⚠️ WhatsApp not ready yet');
    return;
  }
  
  console.log(`🔍 Looking for group: "${WHATSAPP_CONFIG.groupName}"`);
  
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📋 Attempting to load chats...');
    
    let groups = [];
    
    // Method 1: Try getChats first
    try {
      const chats = await whatsappClient.getChats();
      groups = chats.filter(chat => chat.isGroup);
      console.log(`✅ Method 1: Found ${groups.length} groups via getChats()`);
    } catch (error1) {
      console.log('⚠️ Method 1 failed:', error1.message);
      
      // Method 2: Try alternative approach with timeout
      try {
        console.log('🔄 Trying alternative method to find groups...');
        await whatsappClient.getState();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const chats = await whatsappClient.getChats();
        groups = chats.filter(chat => chat.isGroup);
        console.log(`✅ Method 2: Found ${groups.length} groups`);
      } catch (error2) {
        console.log('⚠️ Method 2 failed:', error2.message);
      }
    }
    
    if (groups.length === 0) {
      console.log('❌ No groups found.');
      return;
    }
    
    console.log(`📊 Total groups found: ${groups.length}`);
    
    // Search for target group
    const targetGroup = groups.find(group => 
      group.name && 
      group.name.toLowerCase().includes(WHATSAPP_CONFIG.groupName.toLowerCase())
    );
    
    if (targetGroup) {
      targetGroupId = targetGroup.id._serialized;
      console.log(`✅ GROUP FOUND: "${targetGroup.name}"`);
      console.log(`👥 Group ID: ${targetGroupId}`);
      console.log('🎉 Group connection automated successfully!');
      return;
    }
    
    // If exact match not found, try partial matches
    console.log('🔍 Exact group name not found, trying partial matches...');
    
    const searchTerms = ['demand', 'supply', 'bb', 'construction'];
    
    for (const term of searchTerms) {
      const matchingGroup = groups.find(group => 
        group.name && group.name.toLowerCase().includes(term.toLowerCase())
      );
      
      if (matchingGroup) {
        targetGroupId = matchingGroup.id._serialized;
        console.log(`✅ Found related group: "${matchingGroup.name}" (contains "${term}")`);
        console.log(`👥 Using group ID: ${targetGroupId}`);
        console.log('💡 You might want to update WHATSAPP_CONFIG.groupName to match exactly');
        return;
      }
    }
    
    // If still not found, list available groups
    console.log('📋 Available groups:');
    groups.slice(0, 10).forEach((group, i) => {
      console.log(`   ${i+1}. ${group.name || 'Unnamed Group'}`);
    });
    
    if (groups.length > 0) {
      // Use the first group as fallback (for testing)
      targetGroupId = groups[0].id._serialized;
      console.log(`⚠️ Using first available group: "${groups[0].name || 'Unnamed Group'}"`);
      console.log(`👥 Group ID: ${targetGroupId}`);
      console.log('💡 Please update WHATSAPP_CONFIG.groupName to match your group');
    }
    
  } catch (error) {
    console.error('❌ Error finding group:', error.message);
    console.log('🔄 Will retry automatically...');
  }
}

// Manual group search endpoint
async function searchForGroup() {
  if (!whatsappClient || !isWhatsAppReady) {
    return { success: false, error: 'WhatsApp not ready' };
  }
  
  await findWhatsAppGroup();
  
  if (targetGroupId) {
    return { 
      success: true, 
      groupName: WHATSAPP_CONFIG.groupName,
      groupId: targetGroupId,
      message: `Group found: ${WHATSAPP_CONFIG.groupName}`,
      automated: true
    };
  } else {
    return { 
      success: false, 
      message: `Group "${WHATSAPP_CONFIG.groupName}" not found after ${groupSearchAttempts} attempts.`,
      attempts: groupSearchAttempts
    };
  }
}

// Database functions
function initializeDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      demands: [],
      alerts: [],
      users: [
        { 
          id: 1,
          username: 'admin', 
          password: 'admin123', 
          role: 'admin', 
          name: 'Administrator',
          created_at: new Date().toISOString(),
          last_login: null
        },
        { 
          id: 2,
          username: 'construction', 
          password: 'construction123', 
          role: 'construction', 
          name: 'Construction Manager',
          created_at: new Date().toISOString(),
          last_login: null
        },
        { 
          id: 3,
          username: 'procurement', 
          password: 'procurement123', 
          role: 'procurement', 
          name: 'Procurement Officer',
          created_at: new Date().toISOString(),
          last_login: null
        },
        { 
          id: 4,
          username: 'azhar.construction', 
          password: 'azhar123', 
          role: 'construction', 
          name: 'Azhar',
          created_at: new Date().toISOString(),
          last_login: null
        }
      ],
      reportSchedule: {
        enabled: true,
        hour: 15,
        minute: 0,
        sendPDF: true,
        sendSummary: true,
        lastRun: null,
        nextRun: null
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { 
      demands: [], 
      alerts: [], 
      users: [], 
      reportSchedule: reportSchedule 
    };
  }
}

function readDB() {
  const db = initializeDB();
  if (!db.demands) db.demands = [];
  if (!db.alerts) db.alerts = [];
  if (!db.users) db.users = [];
  if (!db.reportSchedule) db.reportSchedule = reportSchedule;
  if (!db.lastDailyReport) db.lastDailyReport = null;
  return db;
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Send message to WhatsApp group
async function sendToWhatsAppGroup(message, alertType = 'ALERT') {
  console.log(`\n📱 SENDING MESSAGE (${alertType})`);
  
  try {
    if (!isWhatsAppReady || !whatsappClient) {
      throw new Error('WhatsApp not ready. Please scan QR code.');
    }
    
    // If group not found, try to find it automatically
    if (!targetGroupId) {
      console.log('🔄 Group not found, attempting to find group...');
      await findWhatsAppGroup();
      
      if (!targetGroupId) {
        console.log('⚠️ Group still not found, but will try to send to last known group or use a fallback');
        
        // Try to get the group from alerts history
        const db = readDB();
        const lastAlert = db.alerts.reverse().find(a => a.groupId);
        
        if (lastAlert && lastAlert.groupId) {
          targetGroupId = lastAlert.groupId;
          console.log(`🔄 Using group ID from previous alert: ${targetGroupId}`);
        } else {
          throw new Error(`Group not found and no previous group ID available.`);
        }
      }
    }

    console.log(`📨 Sending to group ID: ${targetGroupId}`);
    console.log(`📝 Message preview: ${message.substring(0, 100)}...`);
    
    // Send message
    const result = await whatsappClient.sendMessage(targetGroupId, message);
    
    console.log('✅ Message sent successfully!');

    // Save alert
    const db = readDB();
    db.alerts.push({
      id: db.alerts.length + 1,
      type: alertType,
      message: message.substring(0, 300),
      recipient: WHATSAPP_CONFIG.groupName,
      groupId: targetGroupId,
      timestamp: new Date().toISOString(),
      status: 'sent',
      messageId: result.id?._serialized
    });
    writeDB(db);

    return { 
      success: true, 
      messageId: result.id?._serialized,
      groupName: WHATSAPP_CONFIG.groupName,
      groupId: targetGroupId
    };

  } catch (error) {
    console.error('❌ Send error:', error.message);
    
    // Save failed alert
    const db = readDB();
    db.alerts.push({
      id: db.alerts.length + 1,
      type: alertType,
      message: message.substring(0, 300),
      recipient: WHATSAPP_CONFIG.groupName,
      groupId: targetGroupId,
      timestamp: new Date().toISOString(),
      status: 'failed',
      error: error.message
    });
    writeDB(db);

    return { 
      success: false, 
      error: error.message,
      groupName: WHATSAPP_CONFIG.groupName,
      groupId: targetGroupId
    };
  }
}

function getWhatsAppStatus() {
  const db = readDB();
  
  return {
    ready: isWhatsAppReady,
    groupConnected: !!targetGroupId,
    groupName: WHATSAPP_CONFIG.groupName,
    groupId: targetGroupId,
    groupSearchAttempts: groupSearchAttempts,
    maxAttempts: MAX_GROUP_SEARCH_ATTEMPTS,
    qrCode: qrCode,
    qrImageUrl: qrCodeImageUrl,
    reportSchedule: reportSchedule,
    timestamp: new Date().toISOString()
  };
}

// ===================================================
// API ENDPOINTS
// ===================================================

// Home
app.get('/', (req, res) => {
  const db = readDB();
  res.json({
    app: 'Demand-Supply Dashboard',
    version: '8.8',
    status: 'running',
    whatsapp: getWhatsAppStatus(),
    stats: {
      demands: db.demands.length,
      alerts: db.alerts.length,
      users: db.users.length
    },
    baseUrl: BASE_URL,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test WhatsApp
app.post('/api/test/whatsapp', async (req, res) => {
  const testMessage = `📊 *System Test*
━━━━━━━━━━━━━━━━━━━━
✅ Demand-Supply Dashboard v8.8
📊 Dashboard: ${BASE_URL}
🔧 Test message sent successfully`;
  
  const result = await sendToWhatsAppGroup(testMessage, 'TEST');
  
  res.json({
    success: result.success,
    message: result.success ? 
      `Test sent to group: ${result.groupName || WHATSAPP_CONFIG.groupName}` : 
      `Test failed: ${result.error}`,
    result: result
  });
});

// Get WhatsApp status
app.get('/api/whatsapp/status', (req, res) => {
  const db = readDB();
  const alerts = db.alerts || [];
  
  res.json({
    success: true,
    whatsapp: getWhatsAppStatus(),
    recentAlerts: alerts.slice(-5).reverse(),
    stats: {
      total: alerts.length,
      sent: alerts.filter(a => a.status === 'sent').length,
      failed: alerts.filter(a => a.status === 'failed').length
    }
  });
});

// Find group
app.get('/api/whatsapp/find-group', async (req, res) => {
  const result = await searchForGroup();
  res.json(result);
});

// Get QR code
app.get('/api/whatsapp/qr', (req, res) => {
  const status = getWhatsAppStatus();
  
  if (status.qrCode) {
    res.json({
      success: true,
      qrCode: status.qrCode,
      qrImageUrl: status.qrImageUrl,
      message: 'Scan QR code with WhatsApp'
    });
  } else if (status.ready) {
    res.json({
      success: true,
      message: `WhatsApp connected${status.groupConnected ? ` | Group: ${status.groupName}` : ' | Automatically searching for group...'}`,
      groupConnected: status.groupConnected,
      groupSearchAttempts: status.groupSearchAttempts
    });
  } else {
    res.json({
      success: false,
      message: 'Waiting for WhatsApp initialization...'
    });
  }
});

// Create demand
app.post('/api/demand', async (req, res) => {
  const demandData = req.body;
  const db = readDB();
  
  const newId = db.demands.length > 0 ? Math.max(...db.demands.map(d => d.id)) + 1 : 1;
  const newDemand = {
    id: newId,
    ...demandData,
    status: 'Pending',
    created_at: new Date().toISOString(),
    pending_qty: Math.max(0, (demandData.demanded_qty || 0) - (demandData.supplied_qty || 0))
  };
  
  db.demands.push(newDemand);
  writeDB(db);
  
  console.log('✅ Demand created:', newDemand.item);
  
  // Check for multiple demands with same demand number
  const sameDemandNumberDemands = db.demands.filter(d => 
    d.demand_no === newDemand.demand_no && 
    d.project === newDemand.project
  );
  
  // Send to WhatsApp group
  let alertResult = null;
  
  if (sameDemandNumberDemands.length > 1) {
    const whatsappMessage = createCleanGroupedDemandMessage(
      sameDemandNumberDemands,
      newDemand.demand_no,
      newDemand.initiated_by,
      newDemand.project,
      newDemand.priority,
      newDemand.due_date
    );
    
    alertResult = await sendToWhatsAppGroup(whatsappMessage, 'NEW_DEMAND_GROUP');
    console.log(`📊 Sent grouped demand message for demand no: ${newDemand.demand_no} (${sameDemandNumberDemands.length} items)`);
  } else {
    const username = extractUsername(newDemand.initiated_by);
    const whatsappMessage = createCleanDemandMessage(newDemand, username);
    
    alertResult = await sendToWhatsAppGroup(whatsappMessage, 'NEW_DEMAND');
  }
  
  res.status(201).json({
    success: true,
    demand: newDemand,
    isGrouped: sameDemandNumberDemands.length > 1,
    groupedCount: sameDemandNumberDemands.length,
    alertSent: alertResult.success,
    alertResult: alertResult
  });
});

// Update demand
app.patch('/api/demand/:id', async (req, res) => {
  const demandId = parseInt(req.params.id);
  const updates = req.body;
  const updatedBy = req.body.updated_by || 'System';
  
  const db = readDB();
  const demandIndex = db.demands.findIndex(d => d.id === demandId);
  
  if (demandIndex === -1) {
    return res.status(404).json({ success: false, error: 'Demand not found' });
  }
  
  const oldDemand = { ...db.demands[demandIndex] };
  db.demands[demandIndex] = { ...oldDemand, ...updates };
  
  // Update pending quantity
  if (updates.supplied_qty !== undefined) {
    const demanded = db.demands[demandIndex].demanded_qty || 0;
    const supplied = updates.supplied_qty || 0;
    db.demands[demandIndex].pending_qty = Math.max(0, demanded - supplied);
  }
  
  writeDB(db);
  
  // Check if there are multiple demands with same demand number
  const updatedDemand = db.demands[demandIndex];
  const sameDemandNumberDemands = db.demands.filter(d => 
    d.demand_no === updatedDemand.demand_no && 
    d.project === updatedDemand.project
  );
  
  // Send to WhatsApp group if supply updated
  let alertResult = null;
  
  if (updates.supplied_qty > (oldDemand.supplied_qty || 0)) {
    const increase = updates.supplied_qty - (oldDemand.supplied_qty || 0);
    
    if (sameDemandNumberDemands.length > 1) {
      const whatsappMessage = createCleanGroupedSupplyUpdateMessage(
        sameDemandNumberDemands,
        updatedDemand.demand_no,
        updatedBy
      );
      
      alertResult = await sendToWhatsAppGroup(whatsappMessage, 'SUPPLY_UPDATE_GROUP');
      console.log(`📊 Sent grouped supply update for demand no: ${updatedDemand.demand_no} (${sameDemandNumberDemands.length} items)`);
    } else {
      const whatsappMessage = createCleanSupplyUpdateMessage(updatedDemand, updatedBy, increase);
      
      alertResult = await sendToWhatsAppGroup(whatsappMessage, 'SUPPLY_UPDATE');
    }
  }
  
  res.json({
    success: true,
    demand: updatedDemand,
    isGrouped: sameDemandNumberDemands.length > 1,
    groupedCount: sameDemandNumberDemands.length,
    alertSent: alertResult !== null,
    alertResult: alertResult
  });
});

// Get demands
app.get('/api/demand', (req, res) => {
  const db = readDB();
  res.json({ success: true, demands: db.demands });
});

// Get alerts
app.get('/api/alerts', (req, res) => {
  const db = readDB();
  res.json({ success: true, alerts: db.alerts.reverse().slice(0, 50) });
});

// Login - UPDATED WITH SECURITY FEATURES
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // Update last login time
    user.last_login = new Date().toISOString();
    writeDB(db);
    
    const displayName = extractUsername(user.username);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: displayName,
        role: user.role,
        name: user.name,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Get grouped demands by demand number
app.get('/api/demand/grouped', (req, res) => {
  const db = readDB();
  const { demand_no, project } = req.query;
  
  if (!demand_no || !project) {
    return res.status(400).json({ success: false, error: 'demand_no and project are required' });
  }
  
  const groupedDemands = db.demands.filter(d => 
    d.demand_no === demand_no && 
    d.project === project
  );
  
  res.json({
    success: true,
    demand_no,
    project,
    count: groupedDemands.length,
    demands: groupedDemands,
    summary: groupedDemands.length > 0 ? formatMultipleDemandsSummary(groupedDemands) : 'No demands found'
  });
});

// ===================================================
// USER MANAGEMENT ENDPOINTS (ADMIN ONLY)
// ===================================================

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  const { userRole } = req.body;
  
  if (!userRole) {
    return res.status(401).json({ 
      success: false, 
      error: 'User role required' 
    });
  }
  
  if (userRole !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  
  next();
}

// Get all users (Admin only)
app.post('/api/admin/users', isAdmin, (req, res) => {
  const db = readDB();
  
  // Return users without passwords for security
  const safeUsers = db.users.map(user => ({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    created_at: user.created_at,
    last_login: user.last_login
  }));
  
  res.json({
    success: true,
    users: safeUsers,
    count: safeUsers.length
  });
});

// Add new user (Admin only)
app.post('/api/admin/users/add', isAdmin, (req, res) => {
  const { username, password, name, role } = req.body;
  
  if (!username || !password || !name || !role) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username, password, name, and role are required' 
    });
  }
  
  const db = readDB();
  
  // Check if username already exists
  const existingUser = db.users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username already exists' 
    });
  }
  
  // Generate new user ID
  const newId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
  
  // Create new user
  const newUser = {
    id: newId,
    username,
    password, // In production, this should be hashed
    name,
    role: role.toLowerCase(),
    created_at: new Date().toISOString(),
    last_login: null
  };
  
  db.users.push(newUser);
  writeDB(db);
  
  console.log(`✅ New user added: ${username} (${name}) as ${role}`);
  
  res.status(201).json({
    success: true,
    message: `User ${username} added successfully`,
    user: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      created_at: newUser.created_at
    }
  });
});

// Delete user (Admin only)
app.post('/api/admin/users/delete', isAdmin, (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID is required' 
    });
  }
  
  const db = readDB();
  
  // Find user index
  const userIndex = db.users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found' 
    });
  }
  
  // Prevent deleting admin users (optional safety)
  const userToDelete = db.users[userIndex];
  if (userToDelete.role === 'admin') {
    // Count admin users
    const adminCount = db.users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete the last admin user' 
      });
    }
  }
  
  // Remove user
  const deletedUser = db.users.splice(userIndex, 1)[0];
  writeDB(db);
  
  console.log(`🗑️ User deleted: ${deletedUser.username} (${deletedUser.name})`);
  
  res.json({
    success: true,
    message: `User ${deletedUser.username} deleted successfully`,
    deletedUser: {
      id: deletedUser.id,
      username: deletedUser.username,
      name: deletedUser.name,
      role: deletedUser.role
    }
  });
});

// Reset user password (Admin only)
app.post('/api/admin/users/reset-password', isAdmin, (req, res) => {
  const { userId, newPassword } = req.body;
  
  if (!userId || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID and new password are required' 
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password must be at least 6 characters long' 
    });
  }
  
  const db = readDB();
  
  // Find user
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found' 
    });
  }
  
  // Update password
  const oldUsername = user.username;
  user.password = newPassword; // In production, this should be hashed
  
  writeDB(db);
  
  console.log(`🔑 Password reset for user: ${oldUsername}`);
  
  res.json({
    success: true,
    message: `Password for ${user.username} has been reset successfully`,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

// Update user role (Admin only)
app.post('/api/admin/users/update-role', isAdmin, (req, res) => {
  const { userId, newRole } = req.body;
  
  if (!userId || !newRole) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID and new role are required' 
    });
  }
  
  const validRoles = ['admin', 'construction', 'procurement'];
  if (!validRoles.includes(newRole.toLowerCase())) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid role. Valid roles are: ${validRoles.join(', ')}` 
    });
  }
  
  const db = readDB();
  
  // Find user
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found' 
    });
  }
  
  // Prevent changing the last admin's role
  if (user.role === 'admin' && newRole !== 'admin') {
    const adminCount = db.users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot change role of the last admin user' 
      });
    }
  }
  
  // Update role
  const oldRole = user.role;
  user.role = newRole.toLowerCase();
  
  writeDB(db);
  
  console.log(`🔄 Role changed for ${user.username}: ${oldRole} → ${user.role}`);
  
  res.json({
    success: true,
    message: `Role for ${user.username} changed from ${oldRole} to ${user.role}`,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

// ===================================================
// REPORT SCHEDULING ENDPOINTS (ADMIN ONLY)
// ===================================================

// Get report schedule (Admin only)
app.post('/api/admin/report/schedule', isAdmin, (req, res) => {
  res.json({
    success: true,
    schedule: reportSchedule,
    nextRun: dailyReportJob ? dailyReportJob.nextInvocation() : null
  });
});

// Update report schedule (Admin only)
app.post('/api/admin/report/schedule/update', isAdmin, (req, res) => {
  try {
    const newSchedule = req.body;
    
    // Validate input
    if (newSchedule.hour !== undefined && (newSchedule.hour < 0 || newSchedule.hour > 23)) {
      return res.status(400).json({ success: false, error: 'Hour must be between 0 and 23' });
    }
    
    if (newSchedule.minute !== undefined && (newSchedule.minute < 0 || newSchedule.minute > 59)) {
      return res.status(400).json({ success: false, error: 'Minute must be between 0 and 59' });
    }
    
    const updatedSchedule = updateReportSchedule(newSchedule);
    
    res.json({
      success: true,
      message: 'Report schedule updated successfully',
      schedule: updatedSchedule,
      nextRun: dailyReportJob ? dailyReportJob.nextInvocation() : null
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get report statistics (Admin only)
app.post('/api/admin/report/stats', isAdmin, (req, res) => {
  const stats = generateDailyReportStats();
  res.json({
    success: true,
    stats: stats,
    generatedAt: new Date().toISOString()
  });
});

// Preview daily summary (Admin only)
app.post('/api/admin/report/preview/summary', isAdmin, (req, res) => {
  const stats = generateDailyReportStats();
  const summaryMessage = createShortSummaryMessage(stats, { filename: 'preview.pdf', url: '#' });
  res.json({
    success: true,
    preview: summaryMessage,
    generatedAt: new Date().toISOString()
  });
});

// Generate and download PDF report (Admin only)
app.post('/api/admin/report/generate-pdf', isAdmin, async (req, res) => {
  try {
    if (!PDFDocument || !moment) {
      return res.status(500).json({
        success: false,
        error: 'PDF dependencies not installed. Please run: npm install pdfkit moment'
      });
    }
    
    const stats = generateDailyReportStats();
    const pdfResult = await generatePDFReport(stats);
    
    res.json({
      success: true,
      message: 'PDF report generated successfully',
      pdf: pdfResult,
      stats: stats,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get list of generated reports (Admin only)
app.post('/api/admin/report/list', isAdmin, (req, res) => {
  try {
    const files = fs.readdirSync(path.join(__dirname, 'reports'))
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filepath = path.join(__dirname, 'reports', file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          filepath: filepath,
          url: `${BASE_URL}/reports/${file}`,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created); // Newest first
    
    res.json({
      success: true,
      reports: files,
      count: files.length,
      reportsDir: path.join(__dirname, 'reports')
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send daily report manually (Admin only)
app.post('/api/admin/report/send-daily', isAdmin, async (req, res) => {
  try {
    const result = await sendDailyReport();
    res.json({
      success: result.success,
      message: result.success ? 
        'Daily report sent successfully' : 
        `Failed to send daily report: ${result.error}`,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================================
// PUBLIC ENDPOINTS (FOR ALL USERS)
// ===================================================

// Get report statistics (Public - for dashboard display)
app.get('/api/report/stats', (req, res) => {
  const stats = generateDailyReportStats();
  res.json({
    success: true,
    stats: stats,
    generatedAt: new Date().toISOString()
  });
});

// Preview daily summary (Public)
app.get('/api/report/preview/summary', (req, res) => {
  const stats = generateDailyReportStats();
  const summaryMessage = createShortSummaryMessage(stats, { filename: 'preview.pdf', url: '#' });
  res.json({
    success: true,
    preview: summaryMessage,
    generatedAt: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  const status = getWhatsAppStatus();
  
  res.json({
    success: true,
    status: 'healthy',
    whatsapp: {
      ready: status.ready,
      groupConnected: status.groupConnected,
      groupName: status.groupName,
      groupSearchAttempts: status.groupSearchAttempts,
      maxAttempts: status.maxAttempts
    },
    version: '8.8',
    timestamp: new Date().toISOString()
  });
});

// Manual group override endpoint
app.post('/api/whatsapp/set-group', (req, res) => {
  const { groupId, groupName } = req.body;
  
  if (groupId) {
    targetGroupId = groupId;
    console.log(`✅ Manual group override: ${groupId}`);
    
    if (groupName) {
      console.log(`📝 Group name set to: ${groupName}`);
    }
    
    res.json({
      success: true,
      message: 'Group ID set manually',
      groupId: targetGroupId,
      groupName: groupName || WHATSAPP_CONFIG.groupName
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'groupId is required'
    });
  }
});

// ===================================================
// ADDITIONAL ENDPOINTS FOR ONLINE DEPLOYMENT
// ===================================================

// System info endpoint
app.get('/api/system/info', (req, res) => {
  res.json({
    success: true,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      baseUrl: BASE_URL,
      port: PORT
    }
  });
});

// Serve static files (for reports)
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Serve frontend if exists (optional)
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/system/info',
      'GET /api/whatsapp/status',
      'GET /api/demand',
      'POST /api/demand',
      'PATCH /api/demand/:id',
      'POST /api/login',
      // Add other endpoints as needed
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

// ===================================================
// ✅ FIX 2: SERVER START FOR VERCEL
// ===================================================

// Start server only if not running on Vercel
if (process.env.VERCEL !== '1') {
  // ✅ FIX 2: Changed from app.listen(3001) to app.listen(PORT)
  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 DEMAND-SUPPLY DASHBOARD v8.8 - VERCEL READY');
    console.log(`📊 Server: ${BASE_URL}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📱 WhatsApp Group: "${WHATSAPP_CONFIG.groupName}"`);
    console.log('='.repeat(60));
    
    // Start WhatsApp
    initializeWhatsApp();
  });
}

// ✅ FIX 3: EXPORT FOR VERCEL - ADD THIS AT THE VERY END
module.exports = app;