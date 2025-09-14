// post-detail.js - الإصدار المعدل مع إصلاح المشاكل
import { 
  auth, database, serverTimestamp,
  ref, push, onValue, get
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
            
            // محاولة الحصول على بيانات المنشور من localStorage
            const postData = JSON.parse(localStorage.getItem('currentPost'));
            
            // إذا لم توجد في localStorage، جرب الحصول من URL parameters
            if (!postData) {
                const urlParams = new URLSearchParams(window.location.search);
                const postId = urlParams.get('id');
                
                if (postId) {
                    await loadPostFromDatabase(postId);
                } else {
                    showError("لم يتم العثور على المنشور");
                    return;
                }
            } else {
                currentPost = postData;
                showPostDetail(postData);
            }
            
            await loadAdminUsers();
        } else {
            // توجيه المستخدم إلى صفحة تسجيل الدخول إذا لم يكن مسجلاً
            window.location.href = 'login.html';
        }
    });
});

// تحميل المنشور من قاعدة البيانات
async function loadPostFromDatabase(postId) {
    try {
        const postRef = ref(database, 'posts/' + postId);
        const snapshot = await get(postRef);
        
        if (snapshot.exists()) {
            currentPost = { id: postId, ...snapshot.val() };
            showPostDetail(currentPost);
            // حفظ في localStorage للاستخدام المستقبلي
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
        } else {
            showError("لم يتم العثور على المنشور في قاعدة البيانات");
        }
    } catch (error) {
        console.error('Error loading post:', error);
        showError("حدث خطأ أثناء تحميل المنشور");
    }
}

// عرض رسالة الخطأ
function showError(message) {
    postDetailContent.innerHTML = `<p class="error">${message}</p>`;
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 3000);
}

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
        const userRef = ref(database, 'users/' + currentUserId);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            
            // تحديث واجهة المستخدم
            const usernameElement = document.getElementById('username');
            const userAvatarElement = document.getElementById('user-avatar');
            const userRankElement = document.getElementById('user-rank-display');
            const adminBadgeElement = document.getElementById('admin-badge');
            
            if (usernameElement) {
                usernameElement.textContent = userData.name || userData.email.split('@')[0];
            }
            
            if (userAvatarElement) {
                userAvatarElement.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || userData.email)}&background=random`;
            }
            
            if (userRankElement) {
                userRankElement.textContent = `مرتبة: ${userData.rank || 0}`;
            }
            
            if (adminBadgeElement && userData.isAdmin) {
                adminBadgeElement.style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// تحميل المشرفين (إصدار معدل)
async function loadAdminUsers() {
    try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        adminUsers = [];
        if (snapshot.exists()) {
            const users = snapshot.val();
            for (const userId in users) {
                // التحقق من وجود حقل isAdmin وقيمته
                if (users[userId].isAdmin === true) {
                    adminUsers.push(userId);
                    console.log("تم العثور على مشرف:", userId);
                }
            }
            
            if (adminUsers.length === 0) {
                console.warn("لم يتم العثور على أي مشرفين في النظام");
            }
        } else {
            console.error("لا توجد بيانات المستخدمين في قاعدة البيانات");
        }
    } catch (error) {
        console.error("Error loading admin users:", error);
    }
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
            
            ${post.location ? `
                <div class="meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>الموقع: ${post.location}</span>
                </div>
            ` : ''}
            
            ${post.phone ? `
                <div class="meta-item">
                    <i class="fas fa-phone"></i>
                    <span>رقم الهاتف: ${post.phone}</span>
                </div>
            ` : ''}
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
buyNowBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    
    if (!user) {
        alert('يجب تسجيل الدخول أولاً');
        window.location.href = 'auth.html';
        return;
    }
    
    // إعادة تحميل قائمة المشرفين للتأكد من أنها حديثة
    await loadAdminUsers();
    
    if (adminUsers.length === 0) {
        alert('لا توجد إدارة متاحة حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم.');
        return;
    }
    
    // إنشاء طلب جديد
    createOrder(user.uid, currentPost);
});

// إنشاء طلب جديد
async function createOrder(userId, post) {
    try {
        // اختيار مشرف عشوائي من القائمة
        const randomAdminId = adminUsers[Math.floor(Math.random() * adminUsers.length)];
        
        const orderData = {
            buyerId: userId,
            sellerId: post.authorId || 'unknown',
            postId: post.id || Date.now(),
            postTitle: post.title,
            postPrice: post.price || 'غير محدد',
            postImage: post.imageUrl || '',
            status: 'pending',
            assignedAdmin: randomAdminId,
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
