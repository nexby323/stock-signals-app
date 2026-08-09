import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  FlatList, // adaded for the scrollable stock list
  Animated, // required for our custom GeeksforGeeks style switch
  ActivityIndicator, // loading spinner
  Dimensions // to get screen width for the chart
} from 'react-native';
//for knowing the ipv4 of the computer that run the server
import Constants from 'expo-constants';
// navigation Imports
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;

/**
 * Custom Animated Switch Component (GeeksforGeeks Style)
 * A visually appealing, smooth toggle switch built from scratch.
 */
const CustomSwitch = ({ value, onValueChange }) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#cbd5e1', '#3b82f6'] // gray when off, blue when on
  });

  const circlePosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22] // move circle from left to right
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.customSwitchContainer, { backgroundColor }]}>
        <Animated.View style={[styles.customSwitchCircle, { transform: [{ translateX: circlePosition }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Authentication Screen 
 */
function AuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Automatically detects the local machine's IP address during development.
   * This prevents the need to hardcode dynamic local IP addresses.
   */
  const getServerUrl = () => {
    // if the app is compiled for production, return the real internet URL
    if (!__DEV__) {
      return 'https://your-real-domain.com'; // when we'll buy a real domain 
    }

    // extract the IP address that Expo uses to communicate with the phone
    const hostUri = Constants?.expoConfig?.hostUri;
    
    if (hostUri) {
      // hostUri usually looks like "192.168.1.15:8081"
      // we split it by ':' to get just the IP, and attach our Node.js port (3000)
      return `http://${hostUri.split(':')[0]}:3000`;
    }

    // fallback just in case something fails
    return 'http://localhost:3000';
  };

  // store the detected URL globally for the app to use
  const SERVER_URL = getServerUrl();
  
  /*
    you need to do all the Authintication things, the client side fetch the data
    (email and password - need to add all the other feilds for the registretion)
    but the path to this we need to put on the server.js 
    and on the server code this is the place when we need 
    SQL queries to the db (update for regestration and validate login)
  */

  /**
   * Handles user authentication by sending a POST request to the Node.js backend.
   */
  const handleAuthentication = async () => {
    setErrorMessage('');
    
    if (!email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    try {
      // determine the correct endpoint based on the current mode
      const endpoint = isLogin ? '/api/login' : '/api/register';

      // send the HTTP POST request to the server
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        // send the email and password as a JSON string
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      // parse the JSON response from the server
      const data = await response.json();

      // check if the HTTP status code is in the success range (200-299)
      if (response.ok) {
        // success-> navigate to the Home screen and pass the email
        navigation.replace('Home', { userEmail: email });
      } else {
        // server returned an error (e.g., incorrect password, user already exists)
        setErrorMessage(data.error || 'Authentication failed. Please try again.');
      }

    } catch (error) {
      // this catches network errors 
      console.error("Network Error:", error);
      setErrorMessage('Network error. Check your server connection and IP address.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create an Account'}</Text>
        <Text style={styles.subtitle}>Login to the AI Stock Predictor</Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          keyboardType="email-address"
          autoCapitalize="none" 
          onChangeText={setEmail} 
          value={email} 
        />
        
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          secureTextEntry={true} 
          onChangeText={setPassword} 
          value={password} 
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuthentication}>
          <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => { 
            setIsLogin(!isLogin); 
            setErrorMessage(''); 
          }}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Home / Dashboard Screen
 */
function HomeScreen({ route, navigation }) {
  const { userEmail } = route.params || { userEmail: 'User' };
  
  // state to manage the current theme and data loading
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stockData, setStockData] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], datasets: [{ data: [] }] });

  // fetch real live data from the Node.js backend which connects to MarketAPI
  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        // calling our own backend to get the real processed data
        const response = await fetch(`${SERVER_URL}/api/stocks`);
        const data = await response.json();

        if (response.ok) {
        
          setStockData(data.stocks);
          setChartData(data.chart);
        } else {
          console.error("Failed to fetch from server:", data.error);
        }
      } catch (error) {
        console.error("Network Error while fetching stocks:", error);
      } finally {
        setIsLoading(false); // stop the loading spinner whether it succeeded or failed
      }
    };

    fetchRealTimeData();
  }, []);

  // define our theme colors dynamically based on the state (open for changes)
  const currentTheme = {
    background: isDarkMode ? '#0f172a' : '#f4f4f8',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    subText: isDarkMode ? '#94a3b8' : '#475569',
    cardBackground: isDarkMode ? '#1e293b' : '#ffffff',
    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
  };

  /**
   * Defines how a single stock item is rendered in the list
   */
  const renderStockItem = ({ item }) => (
    <View style={[styles.stockCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.borderColor }]}>
      <View>
        <Text style={[styles.stockSymbol, { color: currentTheme.text }]}>{item.symbol}</Text>
        <Text style={[styles.stockName, { color: currentTheme.subText }]}>{item.name}</Text>
      </View>
      <View style={styles.priceContainer}>
        <Text style={[styles.stockPrice, { color: currentTheme.text }]}>
          ${item.price.toFixed(2)}
        </Text>
        <Text style={[styles.stockTrend, { color: item.isUp ? '#22c55e' : '#ef4444' }]}>
          {item.trend}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.dashboardContainer, { backgroundColor: currentTheme.background }]}>
      
      {/* Header Section with Custom Dark Mode Toggle */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.dashboardTitle, { color: currentTheme.text, marginTop: 0 }]}>Market Overview</Text>
          <Text style={[styles.dashboardSubtitle, { color: currentTheme.subText, marginBottom: 0 }]}>{userEmail}</Text>
        </View>
        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleText, { color: currentTheme.subText }]}>
            {isDarkMode ? 'Dark' : 'Light'}
          </Text>
          {/* Using our new Custom GeeksforGeeks Switch */}
          <CustomSwitch value={isDarkMode} onValueChange={setIsDarkMode} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={[styles.loadingText, { color: currentTheme.text }]}>Fetching live market data...</Text>
        </View>
      ) : (
        <>
          {/* Interactive Line Chart */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <LineChart
              data={chartData}
              width={screenWidth - 40}
              height={220}
              yAxisLabel="$"
              chartConfig={{
                backgroundColor: currentTheme.cardBackground,
                backgroundGradientFrom: currentTheme.cardBackground,
                backgroundGradientTo: currentTheme.cardBackground,
                decimalPlaces: 1,
                color: (opacity = 1) => isDarkMode ? `rgba(96, 165, 250, ${opacity})` : `rgba(59, 130, 246, ${opacity})`,
                labelColor: (opacity = 1) => currentTheme.subText,
                style: { borderRadius: 16 },
                propsForDots: { r: "4", strokeWidth: "2", stroke: "#3b82f6" }
              }}
              bezier
              style={{ borderRadius: 16 }}
            />
          </View>

          {/* The Scrollable List of Stocks */}
          <FlatList
            data={stockData}
            keyExtractor={(item) => item.id}
            renderItem={renderStockItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={() => navigation.replace('Auth')} 
      >
        <Text style={styles.primaryButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

// create the Stack Navigator
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Styles
const styles = StyleSheet.create({
  // --- Auth Styles ---
  container: { flex: 1, backgroundColor: '#f4f4f8', justifyContent: 'center' },
  formContainer: { paddingHorizontal: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 15, fontWeight: '500' },
  input: { backgroundColor: '#ffffff', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  primaryButton: { backgroundColor: '#3b82f6', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  
  // --- Custom Switch Styles ---
  customSwitchContainer: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', padding: 2 },
  customSwitchCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  
  // --- Dashboard Styles ---
  dashboardContainer: { flex: 1, paddingTop: 50, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dashboardTitle: { fontSize: 24, fontWeight: 'bold' },
  dashboardSubtitle: { fontSize: 14 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center' },
  toggleText: { marginRight: 8, fontSize: 14, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, fontWeight: '500' },
  listContent: { paddingBottom: 20 },
  stockCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  stockSymbol: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  stockName: { fontSize: 14 },
  priceContainer: { alignItems: 'flex-end' },
  stockPrice: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  stockTrend: { fontSize: 14, fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#ef4444', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginVertical: 20 },
});