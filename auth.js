// ═══════════════════════════════════════════════════════════
// تسجيل الدخول / إنشاء حساب — Firebase Auth فقط، والرتبة بتتسجل في شيت Users
// ═══════════════════════════════════════════════════════════
import { auth, usernameToEmail, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { registerUser } from './sheets-service.js';

const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const closeMessageBtn = document.getElementById('closeMessageBtn');

async function signIn() {
    const username = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) { showMessage('يرجى ملء جميع الحقول'); return; }

    showMessage('جاري تسجيل الدخول...');
    try {
        await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
        showMessage('تم تسجيل الدخول بنجاح!');
        setTimeout(() => { window.location.href = 'home.html'; }, 800);
    } catch (error) {
        console.error(error);
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
            showMessage('اسم المستخدم أو كلمة المرور غير صحيحة');
        } else {
            showMessage(`فشل تسجيل الدخول: ${error.message}`);
        }
    }
}

async function signUp() {
    const username = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();

    if (!username || !password) { showMessage('يرجى ملء جميع الحقول'); return; }
    if (username.length < 3) { showMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'); return; }
    if (password.length < 6) { showMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { showMessage('اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط'); return; }

    showMessage('جاري إنشاء الحساب...');
    try {
        const email = usernameToEmail(username);
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // تسجيل المستخدم في شيت Users (بيحدد رتبته: admin لو اسمه admin بالظبط، غير كده supervisor)
        await registerUser({ uid: cred.user.uid, username, email });

        showMessage('تم إنشاء الحساب! يمكنك تسجيل الدخول الآن');
        setTimeout(() => hideMessage(), 1800);
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            showMessage('اسم المستخدم مستخدم بالفعل، جرب تسجيل الدخول بدل إنشاء حساب جديد');
        } else if (error.code === 'auth/weak-password') {
            showMessage('كلمة المرور ضعيفة جداً');
        } else {
            showMessage(`فشل إنشاء الحساب: ${error.message}`);
        }
    }
}

signInBtn?.addEventListener('click', signIn);
signUpBtn?.addEventListener('click', signUp);
closeMessageBtn?.addEventListener('click', hideMessage);

onAuthStateChanged(auth, (user) => {
    if (user && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
        window.location.href = 'home.html';
    }
});
