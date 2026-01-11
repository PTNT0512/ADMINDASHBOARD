import React, { useState, useEffect } from 'react';

const vietnameseBanks = [
    "Vietcombank", "VietinBank", "BIDV", "Agribank", "Techcombank", "MBBank",
    "VPBank", "ACB", "Sacombank", "HDBank", "TPBank", "VIB", "SHB",
    "LienVietPostBank", "SeABank", "MSB", "Eximbank", "OCB", "Nam A Bank",
    "Bac A Bank", "Viet A Bank", "Kienlongbank", "BaoViet Bank", "PGBank",
    "Saigonbank", "VietBank", "DongA Bank", "GPBank", "OceanBank", "CBBank"
];

const BankDatalist = () => (
    <datalist id="vietnamese-banks">
        {vietnameseBanks.map(bank => <option key={bank} value={bank} />)}
    </datalist>
);

const BankManual = ({ invoke, showToast }) => {
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAccount, setCurrentAccount] = useState({ id: null, bankName: '', accountNumber: '', accountName: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadBankAccounts();
    }, [invoke]);

    const loadBankAccounts = async () => {
        setLoadingAccounts(true);
        const result = await invoke('get-bank-manual');
        if (result.success) {
            setBankAccounts(result.data);
        }
        setLoadingAccounts(false);
    };

    const handleShowModal = (account = null) => {
        if (account) {
            setIsEditing(true);
            setCurrentAccount(account);
        } else {
            setIsEditing(false);
            setCurrentAccount({ id: null, bankName: '', accountNumber: '', accountName: '' });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => setShowModal(false);

    const handleSaveAccount = async () => {
        setSaving(true);
        try {
            let result;
            if (isEditing) {
                result = await invoke('update-bank-manual', { id: currentAccount.id, data: currentAccount });
            } else {
                result = await invoke('add-bank-manual', currentAccount);
            }

            if (result.success) {
                showToast(`Đã ${isEditing ? 'cập nhật' : 'thêm'} tài khoản thành công!`, 'success');
                handleCloseModal();
                loadBankAccounts();
            } else {
                showToast(result.message || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            showToast('Lỗi hệ thống', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async (id) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
            const result = await invoke('delete-bank-manual', id);
            if (result.success) {
                showToast('Đã xóa tài khoản thành công!', 'success');
                loadBankAccounts();
            } else {
                showToast(result.message || 'Lỗi khi xóa', 'error');
            }
        }
    };

    const handleStatusChange = async (id, status) => {
        const result = await invoke('update-bank-manual-status', { id, status });
        if (result.success) {
            showToast('Cập nhật trạng thái thành công!', 'success');
            loadBankAccounts();
        } else {
            showToast(result.message || 'Lỗi khi cập nhật', 'error');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCurrentAccount(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div>
            <div className="tactical-card">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 text-primary fw-bold"><i className="fas fa-hand-holding-usd me-2"></i>Danh Sách Tài Khoản Bank Thủ Công</h5>
                    <button className="btn btn-primary btn-sm" onClick={() => handleShowModal()}>
                        <i className="fas fa-plus me-2"></i>Thêm Mới
                    </button>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover table-striped align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th className="ps-4">Ngân hàng</th>
                                    <th>Số tài khoản</th>
                                    <th>Chủ tài khoản</th>
                                    <th>Trạng thái</th>
                                    <th className="text-end pe-4">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingAccounts ? (
                                    <tr><td colSpan="5" className="text-center py-5 text-muted">Đang tải...</td></tr>
                                ) : bankAccounts.map((acc) => (
                                    <tr key={acc.id}>
                                        <td className="ps-4 fw-bold">{acc.bankName}</td>
                                        <td><code>{acc.accountNumber}</code></td>
                                        <td>{acc.accountName}</td>
                                        <td>
                                            <div className="form-check form-switch">
                                                <input className="form-check-input" type="checkbox" role="switch" checked={acc.status === 1} onChange={(e) => handleStatusChange(acc.id, e.target.checked ? 1 : 0)} />
                                                <span className={`badge bg-${acc.status === 1 ? 'success' : 'secondary'}`}>{acc.status === 1 ? 'Hoạt động' : 'Tạm dừng'}</span>
                                            </div>
                                        </td>
                                        <td className="text-end pe-4">
                                            <button className="btn btn-outline-primary btn-sm me-2" onClick={() => handleShowModal(acc)}><i className="fas fa-edit"></i> Sửa</button>
                                            <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteAccount(acc.id)}><i className="fas fa-trash"></i> Xóa</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-content-custom">
                        <div className="modal-header-custom">
                            <h5>{isEditing ? 'Chỉnh Sửa' : 'Thêm Mới'} Tài Khoản Thủ Công</h5>
                            <button onClick={handleCloseModal} className="btn-close-custom">&times;</button>
                        </div>
                        <div className="modal-body-custom">
                            <div className="form-group-custom">
                                <label>Tên ngân hàng (Viết tắt, VD: MBBank, VCB)</label>
                                <input type="text" name="bankName" value={currentAccount.bankName} onChange={handleInputChange} list="vietnamese-banks" />
                            </div>
                            <div className="form-group-custom">
                                <label>Số tài khoản</label>
                                <input type="text" name="accountNumber" value={currentAccount.accountNumber} onChange={handleInputChange} />
                            </div>
                            <div className="form-group-custom">
                                <label>Tên chủ tài khoản</label>
                                <input type="text" name="accountName" value={currentAccount.accountName} onChange={handleInputChange} />
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <button className="btn btn-secondary" onClick={handleCloseModal}>Hủy</button>
                            <button className="btn btn-primary" onClick={handleSaveAccount} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu lại'}</button>
                        </div>
                    </div>
                </div>
            )}
            <BankDatalist />
        </div>
    );
};

export default BankManual;