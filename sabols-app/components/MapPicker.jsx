import React, { useState, useRef, useMemo } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Crosshair } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

export default function MapPicker({ onLocationSelect, initialLocation }) {
  const [isLoading, setIsLoading] = useState(false);
  const webViewRef = useRef(null);

  const defaultLocation = { latitude: 11.0168, longitude: 76.9558 };
  const startLoc = useRef(initialLocation || defaultLocation);

  React.useEffect(() => {
    // Notify parent immediately so the form has valid coordinates even if user doesn't touch the map
    onLocationSelect({
      coordinates: startLoc.current,
      addressInfo: {},
    });
  }, []);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationChange') {
        onLocationSelect({
          coordinates: { latitude: data.lat, longitude: data.lng },
          addressInfo: {},
        });
      } else if (data.type === 'log') {
        console.log('[Map]', data.msg);
      } else if (data.type === 'error') {
        console.error('[Map ERROR]', data.msg);
      }
    } catch (_) {}
  };

  const html = useMemo(() => {
    const lat = startLoc.current.latitude;
    const lng = startLoc.current.longitude;

    return /* html */`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;font-family:sans-serif;background:#f1f5f9}
    #map{position:absolute;inset:0;z-index:1}

    #search-wrap{ position:absolute;top:12px;left:12px;right:12px;z-index:9999; }
    #search-wrap input{
      width:100%;padding:11px 14px; border-radius:10px;border:1.5px solid #cbd5e1;
      box-shadow:0 2px 8px rgba(0,0,0,0.12); font-size:14px;color:#1e293b;background:#fff; outline:none;
    }
    #suggest-list{
      display:none;position:absolute;top:calc(100% + 6px);left:0;right:0;
      background:#fff;border:1px solid #e2e8f0;border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.14); list-style:none;overflow:hidden;z-index:99999;max-height:280px;overflow-y:auto;
    }
    #suggest-list li{ padding:11px 14px;font-size:13px;color:#374151; border-bottom:1px solid #f1f5f9;cursor:pointer; }
    #suggest-list li:last-child{border-bottom:none}
    #suggest-list li:hover{background:#f8fafc}
    #hint{ position:absolute;bottom:56px;left:0;right:0;text-align:center; font-size:11px;color:#64748b;pointer-events:none;z-index:9999; }
    .leaflet-control-zoom { display: none; }
  </style>
</head>
<body>
  <div id="search-wrap">
    <input id="search-input" type="text" placeholder="Search for building, street, or area…"/>
    <ul id="suggest-list"></ul>
  </div>
  <div id="map"></div>
  <div id="hint">Tap on map or drag the pin to set location</div>

  <script>
    var RN = window.ReactNativeWebView;
    function post(obj){ if(RN) RN.postMessage(JSON.stringify(obj)); }
    function log(msg){ post({type:'log',msg:msg}); }
    function err(msg){ post({type:'error',msg:msg}); }

    var map, marker;
    var curLat = ${lat}, curLng = ${lng};

    function notify(la, ln){ post({type:'locationChange', lat:la, lng:ln}); }

    function moveMarker(la, ln){
      if(!marker) return;
      marker.setLatLng([la, ln]);
      curLat = la; curLng = ln;
    }

    function flyTo(la, ln){
      if(!map) return;
      map.flyTo([la, ln], 16);
    }

    function initMap(){
      try{
        map = L.map('map').setView([curLat, curLng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        marker = L.marker([curLat, curLng], {draggable: true}).addTo(map);

        marker.on('dragend', function(e){
          var p = marker.getLatLng();
          curLat = p.lat; curLng = p.lng;
          notify(curLat, curLng);
        });

        map.on('click', function(e){
          var la = e.latlng.lat, ln = e.latlng.lng;
          moveMarker(la,ln); notify(la,ln);
        });

        initSearch();
      } catch(e){ err('Map init threw: '+e); }
    }

    var searchDebounce = null;
    function buildList(results){
      var list = document.getElementById('suggest-list');
      list.innerHTML = '';
      if(!results || !results.length){ list.style.display='none'; return; }
      results.slice(0, 7).forEach(function(r){
        var li = document.createElement('li');
        var name = r.display_name;
        li.innerHTML = '<div style="font-size:13px;color:#1e293b;font-weight:500">'+name+'</div>';
        li.addEventListener('click', function(){
          list.style.display = 'none';
          document.getElementById('search-input').value = name.split(',')[0];
          var la = parseFloat(r.lat);
          var ln = parseFloat(r.lon);
          if(la && ln){
            moveMarker(la, ln); flyTo(la, ln); notify(la, ln);
          }
        });
        list.appendChild(li);
      });
      list.style.display = 'block';
    }

    function doSearch(query){
      if(!query || query.length < 2){ buildList([]); return; }
      var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query);
      fetch(url, { headers: { 'Accept-Language': 'en' } })
        .then(function(res){ return res.json(); })
        .then(function(d){
          buildList(d || []);
        })
        .catch(function(e){ err('Autosuggest error: '+e); });
    }

    function initSearch(){
      var inp = document.getElementById('search-input');
      if(!inp) return;
      inp.addEventListener('input', function(){
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function(){ doSearch(inp.value.trim()); }, 500);
      });
      inp.addEventListener('blur', function(){
        setTimeout(function(){ document.getElementById('suggest-list').style.display='none'; }, 200);
      });
      inp.addEventListener('focus', function(){
        if(inp.value.trim().length >= 2) doSearch(inp.value.trim());
      });
    }

    window.setLocation = function(la, ln){
      moveMarker(la, ln);
      flyTo(la, ln);
    };

    if(typeof L !== 'undefined') {
       initMap();
    } else {
       var t = setInterval(function() {
          if(typeof L !== 'undefined') {
              clearInterval(t);
              initMap();
          }
       }, 100);
    }
  </script>
</body>
</html>`;
  }, []);

  const getCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Allow location access to use this feature.' });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.setLocation(${latitude}, ${longitude}); true;`);
      }
      onLocationSelect({ coordinates: { latitude, longitude }, addressInfo: {} });
    } catch (e) {
      console.error('Location error:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not get your location.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ height: 340, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#d1d5db', marginVertical: 8, position: 'relative' }}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />

      <TouchableOpacity
        style={{
          position: 'absolute', bottom: 14, right: 14,
          backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12,
          borderRadius: 10, elevation: 4, borderWidth: 1.5, borderColor: '#e2e8f0',
          flexDirection: 'row', alignItems: 'center', gap: 6,
          shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4,
        }}
        onPress={getCurrentLocation}
        disabled={isLoading}
      >
        {isLoading
          ? <ActivityIndicator color="#0ea5e9" size="small" />
          : <Crosshair size={15} color="#0ea5e9" />
        }
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>Use My Location</Text>
      </TouchableOpacity>
    </View>
  );
}
