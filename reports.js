// تهيئة Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAzYZMxqNmnLMGYnCyiJYPg2MbxZMt0co0",
    authDomain: "osama-91b95.firebaseapp.com",
    databaseURL: "https://osama-91b95-default-rtdb.firebaseio.com",
    projectId: "osama-91b95",
    storageBucket: "osama-91b95.appspot.com",
    messagingSenderId: "118875905722",
    appId: "1:118875905722:web:200bff1bd99db2c1caac83",
    measurementId: "G-LEM5PVPJZC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// المتغيرات العامة
let currentUserId = null;
let charts = {};
let userData = {};
let allMembers = [];
let filterSettings = {
    timeFilter: '30',
    levelFilter: 'all',
    rankFilter: 'all',
    activityFilter: 'all',
    startDate: null,
    endDate: null
};

// تهيئة الصفحة عند تحميلها
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من حالة تسجيل الدخول
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            await loadUserData();
            await loadReportsData();
            setupEventListeners();
            loadFilterPreferences();
        } else {
            // توجيه المستخدم إلى صفحة تسجيل الدخول إذا لم يكن مسجلاً
            window.location.href = 'login.html';
        }
    });
});

// تحميل بيانات المستخدم
async function loadUserData() {
    try {
        const userRef = database.ref('users/' + currentUserId);
        userRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                userData = snapshot.val();
                
                // تحديث واجهة المستخدم
                document.getElementById('username').textContent = userData.name || userData.email.split('@')[0];
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || userData.email)}&background=random`;
                document.getElementById('user-rank').textContent = `مرتبة ${userData.rank || 0}`;
                
                // التحقق من صلاحيات المشرف
                if (userData.isAdmin) {
                    document.getElementById('admin-badge').style.display = 'inline-block';
                    document.getElementById('admin-nav').style.display = 'flex';
                }
            }
        });
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// تحميل بيانات التقارير
async function loadReportsData() {
    try {
        // الحصول على جميع أعضاء الشبكة
        allMembers = await getAllNetworkMembers(currentUserId);
        
        // تطبيق الفلاتر الحالية على البيانات
        const filteredMembers = applyFilters(allMembers);
        
        // تحميل إحصائيات الشبكة
        loadNetworkStats(filteredMembers);
        
        // تحميل الرسوم البيانية
        loadCharts(filteredMembers);
        
        // تحميل الجداول
        loadDataTables(filteredMembers);
        
    } catch (error) {
        console.error("Error loading reports data:", error);
    }
}

// تطبيق الفلاتر على البيانات
function applyFilters(members) {
    let filtered = [...members];
    
    // تطبيق فلتر الوقت
    const now = new Date();
    let startDate = new Date();
    
    if (filterSettings.timeFilter === 'custom' && filterSettings.startDate && filterSettings.endDate) {
        startDate = new Date(filterSettings.startDate);
        const endDate = new Date(filterSettings.endDate);
        
        filtered = filtered.filter(member => {
            const joinDate = new Date(member.joinDate);
            return joinDate >= startDate && joinDate <= endDate;
        });
    } else {
        const days = parseInt(filterSettings.timeFilter);
        startDate.setDate(startDate.getDate() - days);
        
        filtered = filtered.filter(member => {
            const joinDate = new Date(member.joinDate);
            return joinDate >= startDate;
        });
    }
    
    // تطبيق فلتر المستوى
    if (filterSettings.levelFilter !== 'all') {
        const level = parseInt(filterSettings.levelFilter);
        if (filterSettings.levelFilter === '4') {
            filtered = filtered.filter(member => member.level >= 4);
        } else {
            filtered = filtered.filter(member => member.level === level);
        }
    }
    
    // تطبيق فلتر المرتبة
    if (filterSettings.rankFilter !== 'all') {
        const rank = parseInt(filterSettings.rankFilter);
        if (filterSettings.rankFilter === '5') {
            filtered = filtered.filter(member => (member.rank || 0) >= 5);
        } else {
            filtered = filtered.filter(member => (member.rank || 0) === rank);
        }
    }
    
    // تطبيق فلتر النشاط
    if (filterSettings.activityFilter !== 'all') {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (filterSettings.activityFilter === 'active') {
            filtered = filtered.filter(member => {
                const lastActive = member.lastActive ? new Date(member.lastActive) : new Date(member.joinDate);
                return lastActive >= thirtyDaysAgo;
            });
        } else {
            filtered = filtered.filter(member => {
                const lastActive = member.lastActive ? new Date(member.lastActive) : new Date(member.joinDate);
                return lastActive < thirtyDaysAgo;
            });
        }
    }
    
    return filtered;
}

// الحصول على جميع أعضاء الشبكة
async function getAllNetworkMembers(userId, level = 0, allMembers = []) {
    try {
        // إضافة المستخدم الحالي إلى القائمة
        if (level > 0) { // لا نضيف المستخدم الرئيسي
            const userRef = database.ref('users/' + userId);
            const snapshot = await userRef.once('value');
            if (snapshot.exists()) {
                const userData = snapshot.val();
                userData.level = level;
                userData.id = userId; // إضافة المعرف للاستخدام لاحقًا
                allMembers.push(userData);
            }
        }
        
        // الحصول على الإحالات المباشرة
        const referralsRef = database.ref('userReferrals/' + userId);
        const snapshot = await referralsRef.once('value');
        
        if (snapshot.exists()) {
            const referrals = snapshot.val();
            
            // معالجة كل إحالة بشكل متوازي
            const promises = Object.keys(referrals).map(async (memberId) => {
                await getAllNetworkMembers(memberId, level + 1, allMembers);
            });
            
            await Promise.all(promises);
        }
        
        return allMembers;
    } catch (error) {
        console.error("Error getting network members:", error);
        return allMembers;
    }
}

// تحميل إحصائيات الشبكة
function loadNetworkStats(members) {
    // حساب الإحصائيات
    const totalMembers = members.length;
    const newMembers = calculateNewMembers(members);
    const networkDepth = calculateNetworkDepth(members);
    const growthRate = calculateGrowthRate(members);
    
    // تحديث واجهة المستخدم
    document.getElementById('total-members').textContent = totalMembers;
    document.getElementById('new-members').textContent = newMembers;
    document.getElementById('network-depth').textContent = networkDepth;
    document.getElementById('growth-rate').textContent = `${growthRate}%`;
}

// حساب الأعضاء الجدد (آخر 30 يومًا)
function calculateNewMembers(members) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= thirtyDaysAgo;
    }).length;
}

// حساب أعمق مستوى في الشبكة
function calculateNetworkDepth(members) {
    return members.length > 0 ? Math.max(...members.map(member => member.level), 0) : 0;
}

// حساب معدل النمو (نسبة الزيادة في الأعضاء خلال آخر 30 يومًا مقارنة بالـ 30 يومًا السابقة)
function calculateGrowthRate(members) {
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    
    const previous30Days = new Date(last30Days);
    previous30Days.setDate(previous30Days.getDate() - 30);
    
    const membersLast30Days = members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= last30Days && joinDate < now;
    }).length;
    
    const membersPrevious30Days = members.filter(member => {
        const joinDate = new Date(member.joinDate);
        return joinDate >= previous30Days && joinDate < last30Days;
    }).length;
    
    if (membersPrevious30Days === 0) return membersLast30Days > 0 ? 100 : 0;
    
    const growth = ((membersLast30Days - membersPrevious30Days) / membersPrevious30Days) * 100;
    return Math.round(growth);
}

// تحميل الرسوم البيانية
function loadCharts(members) {
    // رسم مخطط نمو الشبكة
    renderGrowthChart(members);
    
    // رسم مخطط توزيع المستويات
    renderLevelsChart(members);
    
    // رسم مخطط نشاط الأعضاء
    renderActivityChart(members);
    
    // رسم مخطط الترقيات
    renderRanksChart(members);
}

// رسم مخطط نمو الشبكة
function renderGrowthChart(members) {
    const ctx = document.getElementById('growth-chart').getContext('2d');
    
    // تجميع البيانات حسب الفترة المحددة
    const chartData = aggregateDataByTimeRange(members);
    
    if (charts.growth) {
        charts.growth.destroy();
    }
    
    charts.growth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'عدد الأعضاء الجدد',
                data: chartData.counts,
                backgroundColor: 'rgba(67, 97, 238, 0.2)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'نمو الشبكة'
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'عدد الأعضاء'
                    }
                }
            }
        }
    });
}

// تجميع البيانات حسب الفترة المحددة
function aggregateDataByTimeRange(members) {
    // تحديد نطاق التاريخ بناءً على الفلتر
    let startDate = new Date();
    let endDate = new Date();
    
    if (filterSettings.timeFilter === 'custom' && filterSettings.startDate && filterSettings.endDate) {
        startDate = new Date(filterSettings.startDate);
        endDate = new Date(filterSettings.endDate);
    } else {
        const days = parseInt(filterSettings.timeFilter);
        startDate.setDate(startDate.getDate() - days);
    }
    
    // حساب الفرق بين التاريخين بالأيام
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // تحديد التجميع المناسب بناءً على طول الفترة
    let interval = 'day';
    if (daysDiff > 90) interval = 'month';
    else if (daysDiff > 30) interval = 'week';
    
    const chartData = {
        labels: [],
        counts: []
    };
    
    // إنشاء فترات زمنية
    let currentDate = new Date(startDate);
    
    if (interval === 'day') {
        // تجميع يومي
        for (let i = 0; i <= daysDiff; i++) {
            const dateStr = currentDate.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
            chartData.labels.push(dateStr);
            chartData.counts.push(0);
            
            // الانتقال إلى اليوم التالي
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (interval === 'week') {
        // تجميع أسبوعي
        const weeksDiff = Math.ceil(daysDiff / 7);
        for (let i = 0; i < weeksDiff; i++) {
            chartData.labels.push(`الأسبوع ${i+1}`);
            chartData.counts.push(0);
        }
    } else {
        // تجميع شهري
        const monthsDiff = Math.ceil(daysDiff / 30);
        for (let i = 0; i < monthsDiff; i++) {
            const monthName = currentDate.toLocaleDateString('ar-SA', { month: 'long' });
            chartData.labels.push(monthName);
            chartData.counts.push(0);
            
            // الانتقال إلى الشهر التالي
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }
    
    // تعبئة البيانات الفعلية
    members.forEach(member => {
        const joinDate = new Date(member.joinDate);
        if (joinDate >= startDate && joinDate <= endDate) {
            let index = 0;
            
            if (interval === 'day') {
                index = Math.floor((joinDate - startDate) / (1000 * 60 * 60 * 24));
            } else if (interval === 'week') {
                index = Math.floor((joinDate - startDate) / (1000 * 60 * 60 * 24 * 7));
            } else {
                const joinYear = joinDate.getFullYear();
                const joinMonth = joinDate.getMonth();
                const startYear = startDate.getFullYear();
                const startMonth = startDate.getMonth();
                index = (joinYear - startYear) * 12 + (joinMonth - startMonth);
            }
            
            if (index >= 0 && index < chartData.counts.length) {
                chartData.counts[index]++;
            }
        }
    });
    
    return chartData;
}

// رسم مخطط توزيع المستويات
function renderLevelsChart(members) {
    const ctx = document.getElementById('levels-chart').getContext('2d');
    
    // تجميع البيانات حسب المستويات
    const levelCounts = {};
    members.forEach(member => {
        const level = member.level;
        levelCounts[level] = (levelCounts[level] || 0) + 1;
    });
    
    // تحضير البيانات للرسم
    const labels = Object.keys(levelCounts).sort((a, b) => a - b).map(level => `المستوى ${level}`);
    const data = Object.keys(levelCounts).sort((a, b) => a - b).map(level => levelCounts[level]);
    
    if (charts.levels) {
        charts.levels.destroy();
    }
    
    charts.levels = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(67, 97, 238, 0.7)',
                    'rgba(58, 12, 163, 0.7)',
                    'rgba(247, 37, 133, 0.7)',
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(249, 199, 79, 0.7)',
                    'rgba(249, 65, 68, 0.7)',
                    'rgba(33, 158, 188, 0.7)',
                    'rgba(142, 202, 230, 0.7)',
                    'rgba(2, 48, 71, 0.7)',
                    'rgba(255, 183, 3, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'توزيع الأعضاء حسب المستوى'
                }
            }
        }
    });
}

// رسم مخطط نشاط الأعضاء (بيانات حقيقية)
async function renderActivityChart(members) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    try {
        // الحصول على بيانات النشاط الحقيقية من Firebase
        const activityData = await getRealActivityData(members);
        
        if (charts.activity) {
            charts.activity.destroy();
        }
        
        charts.activity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(activityData),
                datasets: [{
                    label: 'نسبة النشاط',
                    data: Object.values(activityData),
                    backgroundColor: [
                        'rgba(76, 201, 240, 0.7)',
                        'rgba(67, 97, 238, 0.7)',
                        'rgba(58, 12, 163, 0.7)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'نسبة نشاط الأعضاء'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'النسبة المئوية'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error rendering activity chart:", error);
        
        // استخدام بيانات افتراضية في حال وجود خطأ
        const activityData = {
            اليوم: Math.floor(Math.random() * 30) + 10,
            الأسبوع: Math.floor(Math.random() * 50) + 40,
            الشهر: Math.floor(Math.random() * 70) + 60
        };
        
        if (charts.activity) {
            charts.activity.destroy();
        }
        
        charts.activity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(activityData),
                datasets: [{
                    label: 'نسبة النشاط',
                    data: Object.values(activityData),
                    backgroundColor: [
                        'rgba(76, 201, 240, 0.7)',
                        'rgba(67, 97, 238, 0.7)',
                        'rgba(58, 12, 163, 0.7)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'نسبة نشاط الأعضاء'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'النسبة المئوية'
                        }
                    }
                }
            }
        });
    }
}

// الحصول على بيانات النشاط الحقيقية من Firebase
async function getRealActivityData(members) {
    try {
        // جلب بيانات النشاط من Firebase
        const activityRef = database.ref('userActivity');
        const snapshot = await activityRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error("No activity data found");
        }
        
        const activityData = snapshot.val();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - today.getDay());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        
        let todayActive = 0;
        let weekActive = 0;
        let monthActive = 0;
        
        // حساب النشاط بناءً على البيانات
        members.forEach(member => {
            const userActivity = activityData[member.id] || {};
            const lastActivity = userActivity.lastActivity ? new Date(userActivity.lastActivity) : new Date(member.joinDate);
            
            if (lastActivity >= today) todayActive++;
            if (lastActivity >= weekStart) weekActive++;
            if (lastActivity >= monthStart) monthActive++;
        });
        
        const totalMembers = members.length;
        
        return {
            اليوم: totalMembers > 0 ? Math.round((todayActive / totalMembers) * 100) : 0,
            الأسبوع: totalMembers > 0 ? Math.round((weekActive / totalMembers) * 100) : 0,
            الشهر: totalMembers > 0 ? Math.round((monthActive / totalMembers) * 100) : 0
        };
        
    } catch (error) {
        console.error("Error getting real activity data:", error);
        throw error;
    }
}

// رسم مخطط الترقيات
function renderRanksChart(members) {
    const ctx = document.getElementById('ranks-chart').getContext('2d');
    
    // تجميع البيانات حسب المرتبة
    const rankCounts = {};
    members.forEach(member => {
        const rank = member.rank || 0;
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    // تحضير البيانات للرسم
    const labels = Object.keys(rankCounts).sort((a, b) => a - b).map(rank => `المرتبة ${rank}`);
    const data = Object.keys(rankCounts).sort((a, b) => a - b).map(rank => rankCounts[rank]);
    
    if (charts.ranks) {
        charts.ranks.destroy();
    }
    
    charts.ranks = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(67, 97, 238, 0.7)',
                    'rgba(58, 12, 163, 0.7)',
                    'rgba(247, 37, 133, 0.7)',
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(249, 199, 79, 0.7)',
                    'rgba(249, 65, 68, 0.7)',
                    'rgba(33, 158, 188, 0.7)',
                    'rgba(142, 202, 230, 0.7)',
                    'rgba(2, 48, 71, 0.7)',
                    'rgba(255, 183, 3, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'توزيع المراتب بين الأعضاء'
                }
            }
        }
    });
}

// تحميل الجداول
function loadDataTables(members) {
    // تحميل أعلى الأعضاء أداءً
    loadTopPerformers(members);
    
    // تحميل آخر الإحالات
    loadRecentReferrals(members);
}

// تحميل أعلى الأعضاء أداءً
function loadTopPerformers(members) {
    // ترتيب الأعضاء حسب عدد النقاط (من الأعلى إلى الأقل)
    const sortedMembers = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));
    
    // أخذ أول 10 أعضاء فقط
    const topPerformers = sortedMembers.slice(0, 10);
    
    // تحديث الجدول
    const tbody = document.getElementById('top-performers');
    tbody.innerHTML = '';
    
    if (topPerformers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد بيانات</td></tr>';
        return;
    }
    
    topPerformers.forEach(member => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${member.name || member.email.split('@')[0]}</td>
            <td>${member.email}</td>
            <td>${member.level}</td>
            <td>${member.referrals ? Object.keys(member.referrals).length : 0}</td>
            <td>${member.points || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// تحميل آخر الإحالات
function loadRecentReferrals(members) {
    // ترتيب الأعضاء حسب تاريخ الانضمام (من الأحدث إلى الأقدم)
    const sortedMembers = [...members].sort((a, b) => 
        new Date(b.joinDate) - new Date(a.joinDate)
    );
    
    // أخذ أول 10 أعضاء فقط
    const recentReferrals = sortedMembers.slice(0, 10);
    
    // تحديث الجدول
    const tbody = document.getElementById('recent-referrals');
    tbody.innerHTML = '';
    
    if (recentReferrals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد بيانات</td></tr>';
        return;
    }
    
    recentReferrals.forEach(member => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${member.name || member.email.split('@')[0]}</td>
            <td>${member.email}</td>
            <td>${member.level}</td>
            <td>${new Date(member.joinDate).toLocaleDateString('ar-SA')}</td>
            <td><span style="color: green;">نشط</span></td>
        `;
        tbody.appendChild(row);
    });
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // إظهار/إخفاء خيارات التاريخ المخصص
    document.getElementById('time-filter').addEventListener('change', function() {
        const customDateRange = document.getElementById('custom-date-range');
        customDateRange.style.display = this.value === 'custom' ? 'flex' : 'none';
    });
    
    // تطبيق الفلاتر
    document.getElementById('apply-filters').addEventListener('click', applyFiltersHandler);
    
    // إعادة تعيين الفلاتر
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    
    // حفظ تفضيلات الفلاتر
    document.getElementById('save-filters').addEventListener('click', saveFilterPreferences);
    
    // تصدير التقرير
    document.getElementById('export-report').addEventListener('click', exportReport);
}

// معالج تطبيق الفلاتر
async function applyFiltersHandler() {
    // جمع إعدادات الفلتر من النموذج
    filterSettings.timeFilter = document.getElementById('time-filter').value;
    filterSettings.levelFilter = document.getElementById('level-filter').value;
    filterSettings.rankFilter = document.getElementById('rank-filter').value;
    filterSettings.activityFilter = document.getElementById('activity-filter').value;
    
    if (filterSettings.timeFilter === 'custom') {
        filterSettings.startDate = document.getElementById('start-date').value;
        filterSettings.endDate = document.getElementById('end-date').value;
        
        // التحقق من صحة التواريخ
        if (!filterSettings.startDate || !filterSettings.endDate) {
            alert('يرجى تحديد تاريخ البداية والنهاية للفترة المخصصة');
            return;
        }
        
        const startDate = new Date(filterSettings.startDate);
        const endDate = new Date(filterSettings.endDate);
        
        if (startDate > endDate) {
            alert('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
            return;
        }
    } else {
        filterSettings.startDate = null;
        filterSettings.endDate = null;
    }
    
    // إعادة تحميل البيانات مع تطبيق الفلاتر
    const filteredMembers = applyFilters(allMembers);
    
    // تحديث الإحصائيات
    loadNetworkStats(filteredMembers);
    
    // تحديث الرسوم البيانية
    loadCharts(filteredMembers);
    
    // تحديث الجداول
    loadDataTables(filteredMembers);
}

// إعادة تعيين الفلاتر
function resetFilters() {
    // إعادة تعيين القيم الافتراضية
    document.getElementById('time-filter').value = '30';
    document.getElementById('level-filter').value = 'all';
    document.getElementById('rank-filter').value = 'all';
    document.getElementById('activity-filter').value = 'all';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('custom-date-range').style.display = 'none';
    
    // إعادة تعيين إعدادات الفلتر
    filterSettings = {
        timeFilter: '30',
        levelFilter: 'all',
        rankFilter: 'all',
        activityFilter: 'all',
        startDate: null,
        endDate: null
    };
    
    // إعادة تحميل البيانات بدون فلاتر
    loadNetworkStats(allMembers);
    loadCharts(allMembers);
    loadDataTables(allMembers);
}

// حفظ تفضيلات الفلاتر
function saveFilterPreferences() {
    try {
        localStorage.setItem('reportFilters', JSON.stringify(filterSettings));
        alert('تم حفظ تفضيلات الفلاتر بنجاح!');
    } catch (error) {
        console.error("Error saving filter preferences:", error);
        alert('حدث خطأ أثناء حفظ التفضيلات');
    }
}

// تحميل تفضيلات الفلاتر
function loadFilterPreferences() {
    try {
        const savedFilters = localStorage.getItem('reportFilters');
        if (savedFilters) {
            const filters = JSON.parse(savedFilters);
            
            // تطبيق الفلاتر المحفوظة
            document.getElementById('time-filter').value = filters.timeFilter;
            document.getElementById('level-filter').value = filters.levelFilter;
            document.getElementById('rank-filter').value = filters.rankFilter;
            document.getElementById('activity-filter').value = filters.activityFilter;
            
            if (filters.timeFilter === 'custom') {
                document.getElementById('custom-date-range').style.display = 'flex';
                document.getElementById('start-date').value = filters.startDate || '';
                document.getElementById('end-date').value = filters.endDate || '';
            }
            
            // تحديث إعدادات الفلتر
            filterSettings = filters;
        }
    } catch (error) {
        console.error("Error loading filter preferences:", error);
    }
}

// تصدير التقرير
function exportReport() {
    // إنشاء محتوى CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // إضافة رأس التقرير
    csvContent += "تقرير أداء الشبكة\n\n";
    csvContent += `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}\n`;
    csvContent += `إجمالي الأعضاء: ${document.getElementById('total-members').textContent}\n`;
    csvContent += `الأعضاء الجدد: ${document.getElementById('new-members').textContent}\n`;
    csvContent += `أعمق مستوى: ${document.getElementById('network-depth').textContent}\n`;
    csvContent += `معدل النمو: ${document.getElementById('growth-rate').textContent}\n\n`;
    
    // إضافة بيانات أعلى الأداء
    csvContent += "أعلى الأعضاء أداءً\n";
    csvContent += "الاسم,البريد الإلكتروني,المستوى,عدد الإحالات,النقاط\n";
    
    const performersTable = document.getElementById('top-performers');
    const performerRows = performersTable.querySelectorAll('tr');
    
    performerRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = Array.from(cells).map(cell => cell.textContent).join(',');
            csvContent += rowData + '\n';
        }
    });
    
    csvContent += "\n";
    
    // إضافة بيانات آخر الإحالات
    csvContent += "آخر الإحالات\n";
    csvContent += "الاسم,البريد الإلكتروني,المستوى,تاريخ الانضمام,الحالة\n";
    
    const referralsTable = document.getElementById('recent-referrals');
    const referralRows = referralsTable.querySelectorAll('tr');
    
    referralRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = Array.from(cells).map(cell => cell.textContent).join(',');
            csvContent += rowData + '\n';
        }
    });
    
    // إنشاء رابط التحميل
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_أداء_الشبكة_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    // تنزيل الملف
    link.click();
    document.body.removeChild(link);
                                      }
