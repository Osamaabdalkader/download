// post-detail.js - الإصدار المعدل مع إضافة دعم أيقونات الهيدر والفوتير
import { 
  auth, database, serverTimestamp,
  ref, push, onValue
} from './firebase.js';

// عناصر DOM
const postDetailContent = document.getElementById('post-detail-content');
const buyNowBtn = document.getElementById('buy-now-btn');
const adminIcon = document.getElementById('admin-icon');

// متغيرات النظام
let currentPost = null;
let adminUsers = [];
let currentUserId = null;

// تحميل تفاصيل المنشور
document.addEventListener('DOMContentLoaded', () => {
    // إعداد مستمعي الأحداث للأيقونات
    setupIconEventListeners();
    
    // التحقق من حالة تسجيل الدخول
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            await loadUserData();
            
            const postData = JSON.parse(localStorage.getItem('currentPost'));
            if (postData) {
                currentPost = postData;
                showPostDetail(postData);
                loadAdminUsers();
            } else {
                postDetailContent.innerHTML = '<p class="error">لم يتم العثور على المنشور</p>';
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        } else {
            // توجيه المستخدم إلى صفحة تسجيل الدخول إذا لم يكن مسجلاً
            window.location.href = 'login.html';
        }
    });
});

// إعداد مستمعي الأحداث للأيقونات (مطابق لصفحة التقارير)
function setupIconEventListeners() {
    // أيقونة مجموعتك
    document.getElementById('groups-icon').addEventListener('click', function(e) {
        e.preventDefault();
        handleIconClick('groups-icon');
    });
    
    // أيقونة السلة
    document.getElementById('cart-icon').addEventListener('click', function(e) {
        e.preventDefault();
        handleIconClick('cart-icon');
    });
    
    // أيقونة الدعم
    document.getElementById('support-icon').addEventListener('click', function(e) {
        e.preventDefault();
        handleIconClick('support-icon');
    });
    
    // أيقونة المزيد
    document.getElementById('more-icon').addEventListener('click', function(e) {
        e.preventDefault();
        handleIconClick('more-icon');
    });
    
    // أيقونة الإشعارات
    document.getElementById('notifications-icon').addEventListener('click', function(e) {
        e.preventDefault();
        handleIconClick('notifications-icon');
    });
    
    // أيقونة القائمة الجانبية
    document.getElementById('sidebar-toggle').addEventListener('click', function(e) {
        e.preventDefault();
        handleIconClick('sidebar-toggle');
    });
}

// معالج النقر على الأيقونات (مطابق لصفحة التقارير)
function handleIconClick(iconId) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // إذا كان المستخدم مسجلاً
            switch(iconId) {
                case 'groups-icon':
                    window.location.href = 'dashboard.html';
                    break;
                case 'support-icon':
                    window.location.href = 'messages.html';
                    break;
                case 'cart-icon':
                case 'more-icon':
                case 'notifications-icon':
                case 'sidebar-toggle':
                    alert('هذه الميزة قيد التطوير حالياً');
                    break;
            }
        } else {
            // إذا لم يكن المستخدم مسجلاً
            window.location.href = 'login.html';
        }
    });
}

// تحميل بيانات المستخدم (مطابق لصفحة التقارير)
async function loadUserData() {
    try {
        const userRef = database.ref('users/' + currentUserId);
        userRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                // تحديث واجهة المستخدم
                document.getElementById('username').textContent = userData.name || userData.email.split('@')[0];
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || userData.email)}&background=random`;
                document.getElementById('user-rank-display').textContent = `مرتبة: ${userData.rank || 0}`;
                
                // التحقق من صلاحيات المشرف
                if (userData.isAdmin) {
                    document.getElementById('admin-badge').style.display = 'inline-block';
                }
            }
        });
    } catch (error) {
        console.error("Error loading user data:", error);
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
    });
}

// عرض تفاصيل المنشور
function showPostDetail(post) {
    currentPost = post;
    
    // إنشاء محتوى تفاصيل المنشور
    postDetailContent.innerHTML = `
        ${post.imageUrl ? 
            `<img src="${post.imageUrl}" alt="${post.title}" class="post-detail-image">` : 
            `<div class="post-detail-image" style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05);">
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
