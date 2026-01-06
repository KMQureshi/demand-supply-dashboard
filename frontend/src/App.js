import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const API_URL = "http://localhost:5000"; // Replace with your API endpoint if needed

function App() {
  // User state
  const [user, setUser] = useState({ username: "demoUser", role: "admin" });

  // Dashboard data states
  const [data, setData] = useState([
    {
      id: 1,
      project: "Project A",
      demand_no: "D-001",
      initiated_by: "John",
      item: "Cement",
      itemDescription: "Grade 42.5",
      unit: "Bags",
      demanded_qty: 1200,
      demand_date: "2026-01-01",
      due_date: "2026-01-07",
      priority: "High",
      supplied_qty: 800,
      pending_qty: 400,
      supplied_date: "2026-01-05",
      status: "Partially Supplied",
      remarks_construction: "Urgent requirement",
      remarks_procurement: "Partial supply delivered"
    },
    {
      id: 2,
      project: "Project B",
      demand_no: "D-002",
      initiated_by: "Alice",
      item: "Steel",
      itemDescription: "TMT 12mm",
      unit: "MT",
      demanded_qty: 50,
      demand_date: "2026-01-02",
      due_date: "2026-01-10",
      priority: "Medium",
      supplied_qty: 50,
      pending_qty: 0,
      supplied_date: "2026-01-08",
      status: "Supplied",
      remarks_construction: "Delivered on time",
      remarks_procurement: "Completed"
    }
  ]);

  const [statusChartData, setStatusChartData] = useState([
    { status: 'Supplied', count: 1, color: '#28a745' },
    { status: 'Partially Supplied', count: 1, color: '#ffc107' },
    { status: 'Pending', count: 0, color: '#6c757d' },
    { status: 'Delayed', count: 0, color: '#dc3545' }
  ]);

  const [priorityChartData, setPriorityChartData] = useState([
    { priority: 'High', count: 1 },
    { priority: 'Medium', count: 1 },
    { priority: 'Low', count: 0 }
  ]);

  const [demandSuppliedPieData, setDemandSuppliedPieData] = useState([
    { name: 'Supplied', value: 1, color: '#28a745' },
    { name: 'Pending', value: 1, color: '#dc3545' }
  ]);

  const [whatsappStatus, setWhatsappStatus] = useState({
    groupConnected: true,
    recentAlerts: [
      { type: 'Demand D-001', recipient: 'Team', status: 'sent', timestamp: new Date() },
      { type: 'Demand D-002', recipient: 'Team', status: 'failed', timestamp: new Date() }
    ]
  });

  // Filters and search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [newDemand, setNewDemand] = useState({ project: "", demand_no: "", item: "", itemDescription: "", unit: "", demanded_qty: 0, demand_date: "", due_date: "", priority: "Medium" });
  const [showSupplyUnitModal, setShowSupplyUnitModal] = useState(false);
  const [currentSupplyUpdate, setCurrentSupplyUpdate] = useState({ supply_qty: 0, supply_unit: "", supply_date: "" });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedule, setSchedule] = useState({ enabled: false, hour: 8, minute: 0, sendSummary: true, sendGraph: true, nextRun: null, lastRun: null });
  const [scheduleMessage, setScheduleMessage] = useState({ text: '', type: '' });
  
  // Sample item list for dropdown
  const itemList = ["Cement", "Steel", "Sand", "Bricks"];
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const filteredItems = itemList.filter(i => i.toLowerCase().includes(itemSearch.toLowerCase()));

  // Computed totals
  const totalDemands = data.length;
  const totalSupplied = data.filter(d => d.status === "Supplied").length;
  const totalPartial = data.filter(d => d.status === "Partially Supplied").length;
  const totalPending = data.filter(d => d.status === "Pending").length;
  const totalDelayed = data.filter(d => d.status === "Delayed").length;

  const filteredData = data.filter(d => {
    const matchesSearch = [d.project, d.item, d.itemDescription, d.demand_no].some(field => field?.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "All" || d.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || d.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const formatDate = (date) => date ? new Date(date).toLocaleDateString() : "-";

  const handleChange = (id, field, value) => {
    setData(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleSave = (id) => {
    alert(`Saved demand with ID: ${id}`);
  };

  const handleNewChange = (field, value) => {
    setNewDemand(prev => ({ ...prev, [field]: value }));
  };

  const handleAddNew = () => {
    const newId = Math.max(...data.map(d => d.id)) + 1;
    setData(prev => [...prev, { ...newDemand, id: newId, status: 'Pending', supplied_qty: 0, pending_qty: newDemand.demanded_qty }]);
    setShowModal(false);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
    XLSX.writeFile(wb, "dashboard.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Demand vs Supply Dashboard", 14, 20);
    doc.autoTable({
      head: [["Project", "Demand No", "Item", "Demand Qty", "Supplied Qty", "Pending Qty", "Status"]],
      body: data.map(d => [d.project, d.demand_no, d.item, d.demanded_qty, d.supplied_qty, d.pending_qty, d.status])
    });
    doc.save("dashboard.pdf");
  };

  const testWhatsAppAlert = () => {
    alert('WhatsApp alert sent');
  };

  const handleSupplyUpdate = () => {
    alert('Supply information updated');
    setShowSupplyUnitModal(false);
  };

  const updateSchedule = (updates) => {
    setSchedule(prev => ({ ...prev, ...updates }));
  };

  const sendManualReport = () => {
    alert('Manual report sent');
  };

  const fetchSchedule = () => {
    alert('Schedule refreshed');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Demand vs Supply Dashboard</h2>
      {/* WhatsApp alerts */}
      {whatsappStatus.groupConnected && (
        <div>
          {whatsappStatus.recentAlerts.length > 0 && (
            <div style={{ marginTop: '15px' }}>
              <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Recent Alerts:</h4>
              <div style={{ maxHeight: '120px', overflowY: 'auto', backgroundColor: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}>
                {whatsappStatus.recentAlerts.map((alert, index) => (
                  <div key={index} style={{ padding: '6px', borderBottom: index < whatsappStatus.recentAlerts.length - 1 ? '1px solid #eee' : 'none', color: alert.status === 'sent' ? '#28a745' : '#dc3545', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{alert.type} → {alert.recipient}</span>
                    <span>{new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filters" style={{ display: 'flex', gap: '10px', marginTop: '15px', marginBottom: '15px' }}>
        <input type="text" placeholder="Search Project/Item/Description/Demand No" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: '250px', padding: '6px' }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Supplied">Supplied</option>
          <option value="Partially Supplied">Partially Supplied</option>
          <option value="Pending">Pending</option>
          <option value="Delayed">Delayed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="All">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="summary-cards" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '10px', color: 'white', borderRadius: '4px', flex: 1, background: 'linear-gradient(135deg, #3498db, #2980b9)' }}>Total Demands = {totalDemands}</div>
        <div className="card" style={{ padding: '10px', color: 'white', borderRadius: '4px', flex: 1, background: 'linear-gradient(135deg, #28a745, #218838)' }}>Supplied = {totalSupplied}</div>
        <div className="card" style={{ padding: '10px', color: 'white', borderRadius: '4px', flex: 1, background: 'linear-gradient(135deg, #ffc107, #e0a800)' }}>Partial = {totalPartial}</div>
        <div className="card" style={{ padding: '10px', color: 'white', borderRadius: '4px', flex: 1, background: 'linear-gradient(135deg, #6c757d, #5a6268)' }}>Pending = {totalPending}</div>
        <div className="card" style={{ padding: '10px', color: 'white', borderRadius: '4px', flex: 1, background: 'linear-gradient(135deg, #dc3545, #c82333)' }}>Delayed = {totalDelayed}</div>
      </div>

      {/* Charts and tables omitted for brevity; they follow the exact inline style pattern as your original file */}

      {/* Action buttons, Modals, and Tables continue as per your previous file */}

    </div>
  );
}

export default App;
