// post-detail.js - الإصدار المعدل وفق الكود الأصلي مع تحسينات التكامل
import { 
  auth, database, serverTimestamp,
  ref, push, onValue
} from './firebase.js';

// عناصر DOM
const postDetailContent = document.getElementById('post-detail-content');
const buyNowBtn = document.getElementById('buy-now-btn');
const adminIcon = document.getElementById('admin-icon');
const profileHeaderIcon = document.getElementById('profile-header-icon');
const notificationsIcon = document.getElementById('notifications-icon');

// متغيرات النظام
let currentPost = null;
let adminUsers = [];

// تحميل تفاصيل المنشور
document.addEventListener('DOMContentLoaded', () => {
    const postData = JSON.parse(localStorage.getItem('currentPost'));
    if (postData) {
        currentPost = postData;
        showPostDetail(postData);
        loadAdminUsers();
        setupEventListeners();
    } else {
        postDetailContent.innerHTML = '<p class="error">لم يتم العثور على المنشور</p>';
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // أيقونة الإشعارات
    if (notificationsIcon) {
        notificationsIcon.addEventListener('click', () => {
            alert('صفحة الإشعارات قيد التطوير');
        });
    }

    // أيقونة الملف الشخصي في الهيدر
    if (profileHeaderIcon) {
        profileHeaderIcon.addEventListener('click', () => {
            const user = auth.currentUser;
            if (user) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'login.html';
            }
        });
    }
}

// تحميل المشرفين
function loadAdminUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        adminUsers = [];
        if (snapshot.exists()) {
            const users = snapshot.val();
            for (const userId in users) {
                if (users[userId].isAdmin) {
                    adminUsers.push(userId);
                }
            }
        }
        
        // التحقق من صلاحيات المشرف للمستخدم الحالي
        checkCurrentUserAdminStatus();
    });
}

// التحقق من صلاحيات المشرف للمستخدم الحالي
function checkCurrentUserAdminStatus() {
    const user = auth.currentUser;
    if (user) {
        if (adminUsers.includes(user.uid)) {
            adminIcon.style.display = 'flex';
        }
    }
}

// عرض تفاصيل المنشور
function showPostDetail(post) {
    currentPost = post;
    
    // إنشاء محتوى تفاصيل المنشور
    postDetailContent.innerHTML = `
        ${post.imageUrl ? 
            `<img src="${post.imageUrl}" alt="${post.title}" class="post-detail-image">` : 
            `<div class="post-detail-image" style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1);">
                <i class="fas fa-image fa-3x" style="color: rgba(255, 255, 255, 0.3);"></i>
            </div>`
        }
        
        <h2 class="post-detail-title">${post.title}</h2>
        
        <p class="post-detail-description">${post.description}</p>
        
        <div class="post-detail-meta">
            ${post.price ? `
                <div class="meta-item">
                    <i class="fas fa-tag"></i>
                    <span>السعر: ${post.price}</span>
                </div>
            ` : ''}
            
            <div class="meta-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>الموقع: ${post.location || 'غير محدد'}</span>
            </div>
            
            <div class="meta-item">
                <i class="fas fa-phone"></i>
                <span>رقم الهاتف: ${post.phone || 'غير متاح'}</span>
            </div>
        </div>
        
        <div class="post-detail-author">
            <div class="author-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="author-info">
                <div class="author-name">${post.authorName || 'مستخدم'}</div>
                <div class="author-contact">${post.authorPhone || 'غير متاح'}</div>
            </div>
        </div>
    `;
}

// زر اشتري الآن
buyNowBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    
    if (!user) {
        alert('يجب تسجيل الدخول أولاً');
        window.location.href = 'auth.html';
        return;
    }
    
    if (adminUsers.length === 0) {
        alert('لا توجد إدارة متاحة حالياً');
        return;
    }
    
    // إنشاء طلب جديد
    createOrder(user.uid, currentPost);
});

// إنشاء طلب جديد
async function createOrder(userId, post) {
    try {
        const orderData = {
            buyerId: userId,
            sellerId: post.authorId,
            postId: post.id,
            postTitle: post.title,
            postPrice: post.price || 'غير محدد',
            postImage: post.imageUrl || '',
            status: 'pending',
            createdAt: serverTimestamp()
        };
        
        // حفظ الطلب في قاعدة البيانات
        await push(ref(database, 'orders'), orderData);
        alert('تم إرسال طلبك بنجاح! سوف تتواصل معك الإدارة قريباً.');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error creating order: ', error);
        alert('حدث خطأ أثناء إرسال الطلب: ' + error.message);
    }
}

// التحقق من حالة المصادقة
auth.onAuthStateChanged(user => {
    if (user) {
        // تحميل بيانات المستخدم الحالي
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                // التحقق من صلاحيات المشرف
                if (userData.isAdmin) {
                    adminIcon.style.display = 'flex';
                }
            }
        });
    }
});
