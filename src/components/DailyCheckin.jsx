import React, { useState, useEffect } from 'react';

function DailyCheckin() {
  const [checkinData, setCheckinData] = useState([]);

  const fetchHistory = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-checkin-history');
      if (result.success) setCheckinData(result.data);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <>
      <header><h1>Lịch Sử Điểm Danh</h1></header>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Ngày Điểm Danh</th>
              <th>Phần Thưởng</th>
            </tr>
          </thead>
          <tbody>
            {checkinData.map((item) => (
              <tr key={item.id}>
                <td>{item.userId}</td>
                <td>{new Date(item.date).toLocaleString('vi-VN')}</td>
                <td>{item.reward?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default DailyCheckin;