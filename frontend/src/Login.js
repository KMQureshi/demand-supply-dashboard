import React, { useState } from "react";
import "./App.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const allUsers = [
    { id: 1, username: "ali.bolda.admin", password: "Admin@123", role: "admin", name: "Ali Bolda" },
    { id: 2, username: "hanzla.bodla.admin", password: "Admin@123", role: "admin", name: "Hanzla Bodla" },
    { id: 3, username: "khalid.qureshi.admin", password: "Admin@123", role: "admin", name: "Khalid Qureshi" },
    { id: 4, username: "abubakar.construction", password: "Construct@123", role: "construction", name: "Abubakar" },
    { id: 5, username: "yousuf.construction", password: "Construct@123", role: "construction", name: "Yousuf" },
    { id: 6, username: "rizwan.yousuf.construction", password: "Construct@123", role: "construction", name: "Rizwan Yousuf" },
    { id: 7, username: "azhar.construction", password: "Construct@123", role: "construction", name: "Azhar" },
    { id: 8, username: "ahsan.construction", password: "Construct@123", role: "construction", name: "Ahsan" },
    { id: 9, username: "naveed.construction", password: "Construct@123", role: "construction", name: "Naveed" },
    { id: 10, username: "ashfaq.construction", password: "Construct@123", role: "construction", name: "Ashfaq" },
    { id: 11, username: "amir.shahzad.construction", password: "Construct@123", role: "construction", name: "Amir Shahzad" },
    { id: 12, username: "rizwan.saeed.procurement", password: "Procure@123", role: "procurement", name: "Rizwan Saeed" },
    { id: 13, username: "hamid.procurement", password: "Procure@123", role: "procurement", name: "Hamid" },
    { id: 14, username: "sajid.malik.procurement", password: "Procure@123", role: "procurement", name: "Sajid Malik" },
    { id: 15, username: "sajid.procurement", password: "Procure@123", role: "procurement", name: "Sajid" }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    const user = allUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      onLogin(userWithoutPassword);
      localStorage.setItem('dashboardUser', JSON.stringify(userWithoutPassword));
    } else {
      setError("Invalid username or password");
    }
  };

  React.useEffect(() => {
    const storedUser = localStorage.getItem('dashboardUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        onLogin(user);
      } catch (err) {
        localStorage.removeItem('dashboardUser');
      }
    }
  }, [onLogin]);

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Demand vs Supply Dashboard</h2>
        <h3>Login</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-button">Login</button>
        </form>
        
        <div className="login-info">
          <h4>Login Instructions:</h4>
          <div className="instructions">
            <p>Use your assigned username and password.</p>
            <p><strong>Construction Team:</strong> Create and edit demands</p>
            <p><strong>Procurement Team:</strong> Update supply information</p>
            <p><strong>Admin Team:</strong> Full access to all features</p>
            <p className="contact-admin">Contact administrator for credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;