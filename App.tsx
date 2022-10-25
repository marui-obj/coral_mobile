import React, {useState} from 'react';
import {
  TouchableOpacity,
  Button,
  PermissionsAndroid,
  View,
  Text,
} from 'react-native';
import {PERMISSIONS, RESULTS, requestMultiple} from 'react-native-permissions';

import CheckBox from '@react-native-community/checkbox';

import base64 from 'react-native-base64';
import {BleManager, Device} from 'react-native-ble-plx';
import {LogBox} from 'react-native';

LogBox.ignoreLogs(['new NativeEventEmitter']);
LogBox.ignoreAllLogs();

const BLTManager = new BleManager();

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID_RX = '6d68efe5-04b6-4a85-abc4-c2670b7bf7fd';
const CHARACTERISTIC_UUID_TX = 'f27b53ad-c63d-49a0-8c0f-9f297e6cc520';

const DEVICE_NAME = 'ESP32';

function StringToBool(input: String) {
  if (input === '1') {
    return true;
  } else {
    return false;
  }
}

function BoolToString(input: boolean) {
  if (input === true) {
    return '1';
  } else {
    return '0';
  }
}

const App = () => {
  const [isConnected, setIsConnected] = useState(false);

  const [connectedDevice, setConnectedDevice] = useState<Device>();

  const [message, setMessage] = useState('Hello word!');
  const [LEDValue, setLEDValue] = useState(false);

  async function connectDevice(device: Device) {
    console.log('connect to Device:', device.name);

    device
      .connect()
      .then(device => {
        console.log(device);
        setConnectedDevice(device);
        setIsConnected(true);
        return device.discoverAllServicesAndCharacteristics();
      })
      .then(device => {
        BLTManager.onDeviceDisconnected(device.id, (error, device) => {
          console.log('Device Disconnected');
          setIsConnected(false);
        });

        // Read inital value
        console.log(device);
        //Message
        device
          .readCharacteristicForService(SERVICE_UUID, CHARACTERISTIC_UUID_RX)
          .then(res => {
            console.log(res);
            setMessage(base64.decode(res?.value));
          });

        //LED
        device
          .readCharacteristicForService(SERVICE_UUID, CHARACTERISTIC_UUID_TX)
          .then(res => {
            setLEDValue(StringToBool(base64.decode(res?.value)));
          });

        device.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID_RX,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              setMessage(base64.decode(characteristic?.value));
              console.log(
                'Message update received: ',
                base64.decode(characteristic?.value),
              );
            }
          },
          'messagetransaction',
        );

        //BoxValue
        device.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID_TX,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              setLEDValue(StringToBool(base64.decode(characteristic?.value)));
              console.log(
                'LED Value update received: ',
                base64.decode(characteristic?.value),
              );
            }
          },
          'ledtransaction',
        );

        console.log('Connection established');
      });
  }

  async function sendLEDValue(value: boolean) {
    BLTManager.writeCharacteristicWithResponseForDevice(
      connectedDevice?.id,
      SERVICE_UUID,
      CHARACTERISTIC_UUID_TX,
      base64.encode(BoolToString(value)),
    ).then(characteristic => {
      setLEDValue(value);
      console.log(
        'LED Value Changed to :',
        base64.decode(characteristic.value),
      );
    });
  }

  async function scanDevice() {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    await requestMultiple([
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    ]).then(answere => {
      console.log('scanning');
      // display the Activityindicator

      BLTManager.startDeviceScan(null, null, (error, scannedDevice) => {
        if (error) {
          console.warn(JSON.stringify(error));

          return;
        }

        if (scannedDevice && scannedDevice.name === DEVICE_NAME) {
          console.log(scannedDevice);
          BLTManager.stopDeviceScan();
          connectDevice(scannedDevice);
        }
      });

      setTimeout(() => {
        BLTManager.stopDeviceScan();
      }, 5000);
    });
  }

  async function disconnectDevice() {
    console.log('Disconnecting start');

    if (connectedDevice != null) {
      console.log(connectedDevice);
      const isDeviceConnected = await connectedDevice.isConnected();
      if (isDeviceConnected) {
        BLTManager.cancelTransaction('messagetransaction');
        BLTManager.cancelTransaction('nightmodetransaction');

        BLTManager.cancelDeviceConnection(connectedDevice.id).then(() =>
          console.log('Disconnected compleated'),
        );
      }

      const connectionStatus = await connectedDevice.isConnected();
      if (!connectionStatus) {
        setIsConnected(false);
      }
    }
  }
  return (
    <View>
      <View style={{paddingBottom: 200}}></View>
      <View style={{jusifyContent: "center", alignItems: "center"}}>
        <TouchableOpacity style={{width: 120}}>
          {!isConnected ? (
            <Button
              title="Connect"
              onPress={() => {
                scanDevice();
              }}
              disabled={false}
            />
          ) : (
            <Button
              title="Disonnect"
              onPress={() => {
                disconnectDevice();
              }}
              disabled={false}
            />
          )}
        </TouchableOpacity>
      </View>

      <View style={{jusifyContent: "center", alignItems: "center"}}>
        <Text>{message}</Text>
      </View>

      <View style={{jusifyContent: "center", alignItems: "center"}}>
        <CheckBox
          disabled={false}
          value={LEDValue}
          onValueChange={newValue => {
            // setBoxValue(newValue);
            sendLEDValue(newValue);
          }}
        />
      </View>
    </View>
  );
};

export default App;
