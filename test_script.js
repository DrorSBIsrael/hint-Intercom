
        // Check permissions
        const userRole = sessionStorage.getItem('intercom_user_role');
        if (userRole !== 'admin') {
            window.location.href = 'index.html';
        }
    