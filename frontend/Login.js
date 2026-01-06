import React, { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("construction");

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert("Please enter your name");
      return;
    }
    onLogin({ username, role });
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input type="text" placeholder="Enter your name" value={username} onChange={(e) => setUsername(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="construction">Construction</option>
          <option value="procurement">Procurement</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
