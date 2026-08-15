/**
 * NotificationService.js
 * 
 * Handles local device notifications using Expo. 
 * Connects the output of our AlarmFactory to actual push notifications on the user's screen.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

class NotificationService {
    /**
     * Asks the user for permission to send notifications (crucial for iOS and Android 13+)
     */
    static async requestPermissions() {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
            console.warn('Failed to get push token for push notification!');
            return false;
        }
        return true;
    }

    /**
     * Receives an alarm object from the AlarmFactory and triggers a local notification.
     * 
     * @param {Object} alarmPayload - The structured alarm from AlarmFactory
     */
    static async triggerLocalAlarm(alarmPayload) {
        if (!alarmPayload) return; // Prevent triggering empty alarms

        await Notifications.scheduleNotificationAsync({
            content: {
                title: alarmPayload.title,
                body: alarmPayload.body,
                data: { 
                    symbol: alarmPayload.symbol, 
                    priority: alarmPayload.priority,
                    themeColor: alarmPayload.themeColor 
                },
                sound: true,
            },
            trigger: null, // trigger immediately
        });
    }
}

export default NotificationService;