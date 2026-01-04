// Alert Scheduler for periodic checks
const cron = require('node-cron');
const AlertModel = require('../models/Alert');
const DashboardData = require('../models/DashboardData');
const EmailService = require('./email.service');
const WhatsAppService = require('./whatsapp.service');

class AlertScheduler {
  constructor() {
    this.scheduledJobs = new Map();
    this.init();
  }

  init() {
    // Schedule regular alert checks
    cron.schedule('*/5 * * * *', () => this.checkThresholdAlerts()); // Every 5 minutes
    cron.schedule('0 9 * * *', () => this.sendDailyReport()); // Daily at 9 AM
    cron.schedule('0 18 * * 1-5', () => this.sendEndOfDayAlert()); // Weekdays at 6 PM
  }

  async checkThresholdAlerts() {
    try {
      console.log('🔍 Checking threshold alerts...');
      
      // Fetch current dashboard data (mock - replace with actual data source)
      const currentData = await DashboardData.getLatest();
      
      // Check supply threshold
      if (currentData.supply < currentData.supplyThreshold) {
        await this.triggerAlert({
          type: 'SUPPLY_LOW',
          severity: 'HIGH',
          message: `Supply critically low: ${currentData.supply} units (Threshold: ${currentData.supplyThreshold})`,
          data: currentData,
          channels: ['email', 'whatsapp']
        });
      }

      // Check demand threshold
      if (currentData.demand > currentData.demandThreshold) {
        await this.triggerAlert({
          type: 'DEMAND_HIGH',
          severity: 'MEDIUM',
          message: `Demand exceeded: ${currentData.demand} units (Threshold: ${currentData.demandThreshold})`,
          data: currentData,
          channels: ['email', 'whatsapp']
        });
      }

      // Check inventory ratio
      const inventoryRatio = currentData.supply / currentData.demand;
      if (inventoryRatio < 0.5) {
        await this.triggerAlert({
          type: 'INVENTORY_IMBALANCE',
          severity: 'HIGH',
          message: `Inventory imbalance detected: Supply/Demand ratio is ${inventoryRatio.toFixed(2)}`,
          data: { ...currentData, ratio: inventoryRatio },
          channels: ['email', 'whatsapp']
        });
      }

    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  async triggerAlert(alertConfig) {
    const { type, severity, message, data, channels } = alertConfig;
    
    // Save to database
    const alertRecord = await AlertModel.create({
      type,
      severity,
      message,
      data,
      channels,
      status: 'triggered',
      triggeredAt: new Date()
    });

    // Send through configured channels
    const results = [];

    if (channels.includes('email')) {
      try {
        const emailResult = await EmailService.sendAlertEmail({
          type,
          message,
          recipients: await this.getAlertRecipients('email', severity),
          data
        });
        results.push({ channel: 'email', success: true, result: emailResult });
      } catch (error) {
        results.push({ channel: 'email', success: false, error: error.message });
      }
    }

    if (channels.includes('whatsapp')) {
      try {
        const whatsappResult = await WhatsAppService.broadcast(
          await this.getAlertRecipients('whatsapp', severity),
          `🚨 ${type}\n${message}\n\n📊 Data:\n${JSON.stringify(data, null, 2)}`
        );
        results.push({ channel: 'whatsapp', success: true, result: whatsappResult });
      } catch (error) {
        results.push({ channel: 'whatsapp', success: false, error: error.message });
      }
    }

    // Update alert record with results
    await AlertModel.findByIdAndUpdate(alertRecord._id, {
      status: 'sent',
      results,
      sentAt: new Date()
    });

    return results;
  }

  async getAlertRecipients(channel, severity) {
    // In real implementation, fetch from database based on preferences
    const recipients = {
      email: {
        HIGH: ['ceo@company.com', 'ops-manager@company.com', 'alert-team@company.com'],
        MEDIUM: ['ops-manager@company.com', 'alert-team@company.com'],
        LOW: ['alert-team@company.com']
      },
      whatsapp: {
        HIGH: ['+919876543210', '+919876543211'], // Management numbers
        MEDIUM: ['+919876543212'], // Operations numbers
        LOW: ['+919876543213'] // Support numbers
      }
    };

    return recipients[channel]?.[severity] || recipients[channel]?.['MEDIUM'] || [];
  }

  async sendDailyReport() {
    try {
      const reportData = await DashboardData.getDailySummary();
      
      await EmailService.sendReportEmail(
        reportData,
        ['daily-report@company.com', 'management@company.com'],
        'daily'
      );

      // Send WhatsApp summary to management
      await WhatsAppService.sendMessage({
        to: '+919876543210',
        message: `📊 Daily Report:\nSupply: ${reportData.totalSupply}\nDemand: ${reportData.totalDemand}\nBalance: ${reportData.balance}`
      });

    } catch (error) {
      console.error('Error sending daily report:', error);
    }
  }

  async sendEndOfDayAlert() {
    try {
      const endOfDayData = await DashboardData.getEndOfDayData();
      
      const message = `📈 End of Day Summary:\n` +
        `• Total Supply: ${endOfDayData.supply}\n` +
        `• Total Demand: ${endOfDayData.demand}\n` +
        `• Pending Orders: ${endOfDayData.pendingOrders}\n` +
        `• Critical Items: ${endOfDayData.criticalItems.length}`;

      // Send to operations team
      await WhatsAppService.broadcast(
        ['+919876543212', '+919876543213'],
        message
      );

    } catch (error) {
      console.error('Error sending EOD alert:', error);
    }
  }

  // Schedule custom alert
  scheduleCustomAlert(cronExpression, alertFunction) {
    const job = cron.schedule(cronExpression, alertFunction);
    this.scheduledJobs.set(job.id, job);
    return job.id;
  }

  // Cancel scheduled alert
  cancelScheduledAlert(jobId) {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(jobId);
    }
  }
}

module.exports = new AlertScheduler();