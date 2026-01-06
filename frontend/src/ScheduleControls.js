import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Grid,
  Alert,
  Divider,
  Chip,
  CircularProgress,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BarChartIcon from '@mui/icons-material/BarChart';
import SummaryIcon from '@mui/icons-material/Summarize';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const ScheduleControls = ({ user }) => {
  const [schedule, setSchedule] = useState({
    enabled: true,
    hour: 15,
    minute: 0,
    sendGraph: true,
    sendSummary: true,
    lastRun: null,
    nextRun: null
  });
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [preview, setPreview] = useState({ summary: '', graph: '' });
  const [stats, setStats] = useState(null);

  const steps = [
    { label: 'Enable Scheduling', description: 'Turn daily reports on or off' },
    { label: 'Set Report Time', description: 'Choose when to send reports' },
    { label: 'Configure Messages', description: 'Select what to include in reports' },
    { label: 'Save & Schedule', description: 'Apply your settings' }
  ];

  // Load current schedule
  useEffect(() => {
    fetchSchedule();
    fetchStats();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/report/schedule');
      const data = await response.json();
      if (data.success) {
        setSchedule(data.schedule);
        if (data.nextRun) {
          setActiveStep(3); // Already scheduled
        } else if (data.schedule.enabled) {
          setActiveStep(2);
        }
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      showMessage('Error fetching schedule', 'error');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/report/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPreview = async (type) => {
    try {
      const endpoint = type === 'summary' 
        ? 'http://localhost:3001/api/report/preview/summary'
        : 'http://localhost:3001/api/report/preview/graph';
      
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.success) {
        if (type === 'summary') {
          setPreview(prev => ({ ...prev, summary: data.preview }));
        } else {
          setPreview(prev => ({ ...prev, graph: data.preview }));
        }
        return data.preview;
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
    }
    return '';
  };

  const updateSchedule = async (updates) => {
    setUpdating(true);
    try {
      const response = await fetch('http://localhost:3001/api/report/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      if (data.success) {
        setSchedule(data.schedule);
        showMessage('Schedule updated successfully!', 'success');
        fetchSchedule(); // Refresh
        return true;
      } else {
        showMessage(data.error || 'Failed to update schedule', 'error');
        return false;
      }
    } catch (error) {
      showMessage('Error updating schedule: ' + error.message, 'error');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const sendManualReport = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/report/send-daily', {
        method: 'POST',
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('Report sent successfully!', 'success');
        fetchSchedule(); // Refresh to get updated lastRun
      } else {
        showMessage(data.error || 'Failed to send report', 'error');
      }
    } catch (error) {
      showMessage('Error sending report: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async () => {
    const success = await updateSchedule({ enabled: !schedule.enabled });
    if (success && !schedule.enabled) {
      setActiveStep(1);
    }
  };

  const handleTimeChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    if (field === 'hour' && numValue >= 0 && numValue <= 23) {
      setSchedule(prev => ({ ...prev, hour: numValue }));
    } else if (field === 'minute' && numValue >= 0 && numValue <= 59) {
      setSchedule(prev => ({ ...prev, minute: numValue }));
    }
  };

  const handleSaveTime = async () => {
    const success = await updateSchedule({ 
      hour: schedule.hour, 
      minute: schedule.minute 
    });
    if (success) {
      setActiveStep(2);
    }
  };

  const handleSaveMessageTypes = async () => {
    const success = await updateSchedule({ 
      sendSummary: schedule.sendSummary,
      sendGraph: schedule.sendGraph
    });
    if (success) {
      setActiveStep(3);
    }
  };

  const handleSliderChange = (event, newValue) => {
    const hour = Math.floor(newValue / 4);
    const minute = (newValue % 4) * 15;
    setSchedule(prev => ({ ...prev, hour, minute }));
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not scheduled';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeLabel = (hour, minute) => {
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const sliderValue = schedule.hour * 4 + Math.floor(schedule.minute / 15);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ScheduleIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" gutterBottom>
            Daily Report Scheduler
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Configure automated daily reports for WhatsApp group
          </Typography>
        </Box>
      </Box>

      {message && (
        <Alert 
          severity={messageType} 
          sx={{ mb: 3 }}
          icon={messageType === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
        >
          {message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column - Setup Stepper */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SettingsIcon sx={{ mr: 1 }} />
                Setup Wizard
              </Typography>
              
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel>
                      <Typography variant="subtitle1">{step.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{step.description}</Typography>
                    </StepLabel>
                    <StepContent>
                      {index === 0 && (
                        <Box sx={{ p: 2 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={schedule.enabled}
                                onChange={handleToggleSchedule}
                                color="primary"
                                size="large"
                              />
                            }
                            label={
                              <Typography variant="h6">
                                {schedule.enabled ? 'Daily Reports Enabled' : 'Daily Reports Disabled'}
                              </Typography>
                            }
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {schedule.enabled 
                              ? 'Reports will be sent automatically based on your schedule'
                              : 'No reports will be sent automatically. You can still send manually.'}
                          </Typography>
                          <Button
                            variant="contained"
                            onClick={() => setActiveStep(1)}
                            disabled={!schedule.enabled}
                            sx={{ mt: 2 }}
                          >
                            Continue to Time Settings
                          </Button>
                        </Box>
                      )}
                      
                      {index === 1 && (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Select Report Time
                          </Typography>
                          
                          <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                            <Typography variant="h6" align="center" gutterBottom>
                              {formatTimeLabel(schedule.hour, schedule.minute)}
                            </Typography>
                            <Slider
                              value={sliderValue}
                              onChange={handleSliderChange}
                              min={0}
                              max={95} // 24 hours * 4 (15 min intervals)
                              step={1}
                              marks={[
                                { value: 0, label: '12 AM' },
                                { value: 24, label: '6 AM' },
                                { value: 48, label: '12 PM' },
                                { value: 72, label: '6 PM' },
                                { value: 95, label: '11:45 PM' }
                              ]}
                              valueLabelDisplay="auto"
                              valueLabelFormat={(value) => {
                                const h = Math.floor(value / 4);
                                const m = (value % 4) * 15;
                                return `${h}:${m.toString().padStart(2, '0')}`;
                              }}
                            />
                          </Paper>
                          
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={6}>
                              <TextField
                                label="Hour"
                                type="number"
                                fullWidth
                                value={schedule.hour}
                                onChange={(e) => handleTimeChange('hour', e.target.value)}
                                InputProps={{
                                  inputProps: { min: 0, max: 23 },
                                  endAdornment: <InputAdornment position="end">hr</InputAdornment>,
                                }}
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                label="Minute"
                                type="number"
                                fullWidth
                                value={schedule.minute}
                                onChange={(e) => handleTimeChange('minute', e.target.value)}
                                InputProps={{
                                  inputProps: { min: 0, max: 59 },
                                  endAdornment: <InputAdornment position="end">min</InputAdornment>,
                                }}
                              />
                            </Grid>
                          </Grid>
                          
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                              variant="outlined"
                              onClick={() => setActiveStep(0)}
                            >
                              Back
                            </Button>
                            <Button
                              variant="contained"
                              onClick={handleSaveTime}
                              disabled={updating}
                              startIcon={updating ? <CircularProgress size={20} /> : null}
                            >
                              Save Time
                            </Button>
                          </Box>
                        </Box>
                      )}
                      
                      {index === 2 && (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Select Report Content
                          </Typography>
                          
                          <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={6}>
                              <Paper 
                                sx={{ 
                                  p: 3, 
                                  height: '100%',
                                  border: schedule.sendSummary ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                  bgcolor: schedule.sendSummary ? 'primary.50' : 'transparent'
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                  <SummaryIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                                  <Box>
                                    <Typography variant="h6">Summary Report</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Text-based overview
                                    </Typography>
                                  </Box>
                                </Box>
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={schedule.sendSummary}
                                      onChange={() => setSchedule(prev => ({ ...prev, sendSummary: !prev.sendSummary }))}
                                      color="primary"
                                    />
                                  }
                                  label={schedule.sendSummary ? "Will be sent" : "Will not be sent"}
                                />
                                <Button
                                  size="small"
                                  startIcon={<VisibilityIcon />}
                                  onClick={() => fetchPreview('summary').then(text => alert(text))}
                                  sx={{ mt: 2 }}
                                >
                                  Preview
                                </Button>
                              </Paper>
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                              <Paper 
                                sx={{ 
                                  p: 3, 
                                  height: '100%',
                                  border: schedule.sendGraph ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                  bgcolor: schedule.sendGraph ? 'primary.50' : 'transparent'
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                  <BarChartIcon sx={{ fontSize: 40, mr: 2, color: 'secondary.main' }} />
                                  <Box>
                                    <Typography variant="h6">Visual Report</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Charts & graphs
                                    </Typography>
                                  </Box>
                                </Box>
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={schedule.sendGraph}
                                      onChange={() => setSchedule(prev => ({ ...prev, sendGraph: !prev.sendGraph }))}
                                      color="secondary"
                                    />
                                  }
                                  label={schedule.sendGraph ? "Will be sent" : "Will not be sent"}
                                />
                                <Button
                                  size="small"
                                  startIcon={<VisibilityIcon />}
                                  onClick={() => fetchPreview('graph').then(text => alert(text))}
                                  sx={{ mt: 2 }}
                                >
                                  Preview
                                </Button>
                              </Paper>
                            </Grid>
                          </Grid>
                          
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                              variant="outlined"
                              onClick={() => setActiveStep(1)}
                            >
                              Back
                            </Button>
                            <Button
                              variant="contained"
                              onClick={handleSaveMessageTypes}
                              disabled={updating}
                              startIcon={updating ? <CircularProgress size={20} /> : null}
                            >
                              Save Configuration
                            </Button>
                          </Box>
                        </Box>
                      )}
                      
                      {index === 3 && (
                        <Box sx={{ p: 2 }}>
                          <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <CheckCircleIcon sx={{ fontSize: 40, mr: 2, color: 'success.main' }} />
                              <Box>
                                <Typography variant="h6" color="success.main">
                                  Schedule Active
                                </Typography>
                                <Typography variant="body2">
                                  Your daily reports are scheduled and will be sent automatically.
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                          
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Next Report
                              </Typography>
                              <Typography variant="h6">
                                {schedule.nextRun ? formatTime(schedule.nextRun) : 'Not scheduled'}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Last Report
                              </Typography>
                              <Typography variant="h6">
                                {schedule.lastRun ? formatTime(schedule.lastRun) : 'Never sent'}
                              </Typography>
                            </Grid>
                          </Grid>
                          
                          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                            <Button
                              variant="outlined"
                              onClick={() => setActiveStep(2)}
                            >
                              Edit Settings
                            </Button>
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={sendManualReport}
                              disabled={loading}
                              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                            >
                              Send Report Now
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Status & Stats */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <AccessTimeIcon sx={{ mr: 1 }} />
                Current Schedule
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Chip 
                  label={schedule.enabled ? "ACTIVE" : "INACTIVE"} 
                  color={schedule.enabled ? "success" : "default"}
                  sx={{ mb: 2 }}
                />
                
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Time:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {schedule.hour.toString().padStart(2, '0')}:{schedule.minute.toString().padStart(2, '0')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Status:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {schedule.enabled ? 'Active' : 'Inactive'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Summary:
                    </Typography>
                    <Typography variant="body1">
                      {schedule.sendSummary ? '✓ Enabled' : '✗ Disabled'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Graph:
                    </Typography>
                    <Typography variant="body1">
                      {schedule.sendGraph ? '✓ Enabled' : '✗ Disabled'}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
              
              <Button
                variant="outlined"
                fullWidth
                startIcon={<RefreshIcon />}
                onClick={fetchSchedule}
                disabled={updating}
              >
                Refresh Status
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Report Statistics
              </Typography>
              
              {stats ? (
                <Box>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Total Demands:
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {stats.total}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Today's New:
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {stats.todayDemands}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Pending:
                      </Typography>
                      <Typography variant="body1">
                        {stats.pending}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Supplied:
                      </Typography>
                      <Typography variant="body1">
                        {stats.supplied}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Button
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={fetchStats}
                  >
                    Refresh Stats
                  </Button>
                </Box>
              ) : (
                <CircularProgress size={20} />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                fullWidth
                onClick={sendManualReport}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                size="large"
              >
                Send Now
              </Button>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  fetchPreview('summary').then(text => {
                    if (text) alert(text);
                  });
                }}
                startIcon={<SummaryIcon />}
                size="large"
              >
                Preview Summary
              </Button>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  fetchPreview('graph').then(text => {
                    if (text) alert(text);
                  });
                }}
                startIcon={<BarChartIcon />}
                size="large"
              >
                Preview Graph
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ScheduleControls;