
      
import { useState, useEffect, useRef } from 'react';
import { database, storage, auth } from '../firebase';
import { ref, push, onValue, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Geolocation } from '@capacitor/geolocation';
import Call from './Call';

const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.3;
  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 2);
  oscillator.stop(audioContext.currentTime + 2);
};

export default function Chat({ userId, chatId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showCall, setShowCall] = useState(false);
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const prevMessagesLength = useRef(0);

  useEffect(() => {
    if (!chatId) return;
    const chatRoomId = [userId, chatId].sort().join('_');
    const messagesRef = ref(database, `messages/${chatRoomId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        const sorted = msgs.sort((a, b) => a.timestamp - b.timestamp);
        if (sorted.length > prevMessagesLength.current) {
          const lastMsg = sorted[sorted.length - 1];
          if (lastMsg.from !== userId) {
            playNotificationSound();
          }
        }
        prevMessagesLength.current = sorted.length;
        setMessages(sorted);
      } else setMessages([]);
    });
    return unsubscribe;
  }, [userId, chatId]);

  const sendMessage = async (type, content) => {
    const msg = {
      from: userId,
      to: chatId,
      text: '',
      imageUrl: '',
      fileUrl: '',
      locationUrl: '',
      timestamp: Date.now(),
      deleted: false,
      read: false,
    };
    if (type === 'text') msg.text = content;
    else if (type === 'image') {
      const file = content;
      const fileRefStorage = storageRef(storage, `images/${Date.now()}_${file.name}`);
      await uploadBytes(fileRefStorage, file);
      msg.imageUrl = await getDownloadURL(fileRefStorage);
    } else if (type === 'file') {
      const file = content;
      const fileRefStorage = storageRef(storage, `files/${Date.now()}_${file.name}`);
      await uploadBytes(fileRefStorage, file);
      msg.fileUrl = await getDownloadURL(fileRefStorage);
    } else if (type === 'location') {
      msg.locationUrl = content;
      msg.text = '📍 موقع';
    }
    const chatRoomId = [userId, chatId].sort().join('_');
    const messagesRef = ref(database, `messages/${chatRoomId}`);
    await push(messagesRef, msg);
    setText('');
  };

  const sendLocation = async () => {
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') {
        alert('يرجى السماح للتطبيق باستخدام الموقع');
        return;
      }
      const position = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      await sendMessage('location', locationUrl);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء جلب الموقع');
    }
  };

  const deleteForEveryone = async (messageId) => {
    const chatRoomId = [userId, chatId].sort().join('_');
    const msgRef = ref(database, `messages/${chatRoomId}/${messageId}`);
    await update(msgRef, { deleted: true });
  };

  if (!chatId) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>اختر محادثة</div>;
  if (showCall) return <Call calleeId={chatId} onEnd={() => setShowCall(false)} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: 10, background: '#075E54', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span><strong>{chatId.slice(0, 15)}</strong></span>
        <button onClick={() => setShowCall(true)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20 }}>📞</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")', backgroundRepeat: 'repeat' }}>
        {messages.map((msg) => !msg.deleted && (
          <div key={msg.id} style={{ textAlign: msg.from === userId ? 'right' : 'left', margin: 5 }}>
            <div style={{ display: 'inline-block', background: msg.from === userId ? '#DCF8C6' : '#FFFFFF', padding: 8, borderRadius: 8, maxWidth: '70%' }}>
              {msg.text && <p>{msg.text}</p>}
              {msg.imageUrl && <img src={msg.imageUrl} alt="img" style={{ maxWidth: 200, borderRadius: 8 }} />}
              {msg.fileUrl && <a href={msg.fileUrl} download>📎 تحميل ملف</a>}
              {msg.locationUrl && <a href={msg.locationUrl} target="_blank" rel="noreferrer">📍 عرض الموقع على الخريطة</a>}
              {msg.from === userId && <button onClick={() => deleteForEveryone(msg.id)} style={{ marginLeft: 10, fontSize: 12, background: 'none', border: 'none', color: 'red' }}>🗑️</button>}
              <div style={{ fontSize: 10, color: '#667781', marginTop: 4 }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: 10, background: '#fff', display: 'flex', gap: 5, borderTop: '1px solid #e0e0e0' }}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة..." style={{ flex: 1, padding: 8, borderRadius: 20, border: '1px solid #ccc' }} />
        <button onClick={() => sendMessage('text', text)} style={{ background: '#075E54', color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px' }}>إرسال</button>
        <button onClick={() => imageInputRef.current.click()} style={{ background: 'none', border: 'none', fontSize: 20 }}>📷</button>
        <button onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', fontSize: 20 }}>📎</button>
        <button onClick={sendLocation} style={{ background: 'none', border: 'none', fontSize: 20 }}>📍</button>
        <input type="file" ref={imageInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => sendMessage('image', e.target.files[0])} />
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => sendMessage('file', e.target.files[0])} />
      </div>
    </div>
  );
}
