import { useState, useEffect, useContext } from 'react';
import { auth } from './firebase';
import Auth from './components/Auth';
import ChatsList from './components/ChatsList';
import Chat from './components/Chat';
import Stories from './components/Stories';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import { ThemeContext } from './contexts/ThemeContext';
import { LanguageContext } from './contexts/LanguageContext';

// المكتبات المثبتة والموجودة في package.json
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

function App() {
  const [user, setUser] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const { darkMode } = useContext(ThemeContext);
  const { t } = useContext(LanguageContext);
  const isAdmin = user?.email === 'admin@example.com';

  // طلب جميع الصلاحيات الأساسية
  const requestAllPermissions = async () => {
    try {
      const cameraPerm = await Camera.requestPermissions();
      console.log('Camera:', cameraPerm);
      const locationPerm = await Geolocation.requestPermissions();
      console.log('Location:', locationPerm);
      const micPerm = await VoiceRecorder.requestAudioRecordingPermission();
      console.log('Microphone:', micPerm);
      const notifPerm = await FirebaseMessaging.requestPermissions();
      console.log('Notifications:', notifPerm);
      console.log('تم منح الصلاحيات الأساسية');
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return unsub;
  }, []);

  useEffect(() => {
    requestAllPermissions();
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const permission = await FirebaseMessaging.requestPermissions();
        if (permission.receive === 'granted') {
          console.log('Notifications permission granted');
          const token = await FirebaseMessaging.getToken();
          console.log('FCM Token:', token.token);
          await FirebaseMessaging.addListener('notificationReceived', (payload) => {
            console.log('Notification received:', payload);
          });
          await FirebaseMessaging.addListener('notificationActionPerformed', (payload) => {
            console.log('Notification tapped:', payload);
          });
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };
    setupNotifications();
  }, []);

  if (!user) return <Auth setUser={setUser} />;
  if (showSettings) return <Settings onClose={() => setShowSettings(false)} />;
  if (showDashboard && isAdmin) return <Dashboard />;

  return (
    <div style={{ display: 'flex', height: '100vh', background: darkMode ? '#1e1e1e' : '#f0f2f5' }}>
      <div style={{ width: 380, borderRight: `1px solid ${darkMode ? '#2b2b2b' : '#e0e0e0'}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', background: '#075E54', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>عبد الرحمن روبي - واتساب</h3>
          <div>
            <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, marginRight: 12 }}>⚙️</button>
            <button onClick={() => auth.signOut()} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20 }}>🚪</button>
          </div>
        </div>
        <Stories />
        <ChatsList setCurrentChat={setCurrentChat} />
      </div>
      <Chat userId={user.uid} chatId={currentChat} />
    </div>
  );
}

export default App;
