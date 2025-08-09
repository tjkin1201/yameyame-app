# 사진첩 Naver Band 연동 설계

## 📸 사진첩 시스템 개요

동배즐 앱의 사진첩은 Naver Band와 완전 연동되어 Band에 업로드된 사진들을 앱에서 볼 수 있도록 구현됩니다. 이를 통해 별도의 이미지 저장소 없이도 풍부한 갤러리 기능을 제공할 수 있습니다.

## 🔗 Band 연동 구조

```jsx
📸 사진첩 (PhotosScreen)
├── 🔗 Band 연동 상태
│   ├── 연동 성공/실패 표시
│   ├── 마지막 동기화 시간
│   └── 수동 새로고침 버튼
├── 📂 앨범 목록 (Band에서 가져옴)
│   ├── 앨범 썸네일
│   ├── 앨범명
│   ├── 사진 수
│   └── 최근 업데이트 일시
└── 🖼️ 사진 뷰어
    ├── 그리드 뷰 / 리스트 뷰
    ├── 확대/축소
    ├── 슬라이드쇼
    └── 다운로드 기능
```

## 🔧 Band Photo API 서비스

### 1. API 서비스 구조
```javascript
// src/services/bandPhotoAPI.js
class BandPhotoAPI {
  constructor() {
    this.baseURL = 'https://openapi.band.us/v2';
    this.accessToken = null;
  }

  // Band 인증
  async authenticate() {
    // OAuth 2.0 인증 플로우
    this.accessToken = await bandAuthService.getAccessToken();
  }

  // 앨범 목록 가져오기
  async getAlbums(bandKey) {
    const response = await fetch(
      `${this.baseURL}/bands/${bandKey}/albums`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('앨범 목록을 가져올 수 없습니다.');
    }
    
    const data = await response.json();
    return this.transformAlbumData(data.result_data.items);
  }

  // 앨범의 사진 목록 가져오기
  async getPhotos(bandKey, albumKey, after = null) {
    const params = new URLSearchParams();
    if (after) params.append('after', after);
    params.append('limit', '50'); // 한 번에 최대 50개
    
    const response = await fetch(
      `${this.baseURL}/bands/${bandKey}/albums/${albumKey}/photos?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('사진 목록을 가져올 수 없습니다.');
    }
    
    const data = await response.json();
    return this.transformPhotoData(data.result_data.items);
  }

  // 앨범 데이터 변환
  transformAlbumData(albums) {
    return albums.map(album => ({
      id: album.album_key,
      name: album.name,
      description: album.description || '',
      photoCount: album.photo_count,
      coverPhoto: album.cover_photo ? {
        url: album.cover_photo.url,
        thumbnailUrl: album.cover_photo.thumbnail_url
      } : null,
      createdAt: new Date(album.created_at),
      updatedAt: new Date(album.updated_at || album.created_at)
    }));
  }

  // 사진 데이터 변환
  transformPhotoData(photos) {
    return photos.map(photo => ({
      id: photo.photo_key,
      url: photo.url,
      thumbnailUrl: photo.thumbnail_url,
      description: photo.description || '',
      width: photo.width,
      height: photo.height,
      uploadedAt: new Date(photo.created_at),
      uploader: {
        id: photo.author.user_key,
        name: photo.author.name,
        profileImage: photo.author.profile_image_url
      }
    }));
  }

  // 캐시 관리
  async cachePhotos(photos) {
    // AsyncStorage에 메타데이터 저장
    // 실제 이미지는 CDN URL 사용
    try {
      const cacheData = {
        photos: photos,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(
        `photos_cache_${albumKey}`, 
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('사진 캐시 저장 실패:', error);
    }
  }
}

export default new BandPhotoAPI();
```

### 2. 캐싱 전략
```javascript
// src/utils/photoCache.js
class PhotoCache {
  static CACHE_DURATION = 1000 * 60 * 30; // 30분

  static async getCachedAlbums() {
    try {
      const cached = await AsyncStorage.getItem('band_albums');
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > this.CACHE_DURATION) {
        return null; // 캐시 만료
      }
      
      return data.albums;
    } catch (error) {
      console.warn('앨범 캐시 읽기 실패:', error);
      return null;
    }
  }

  static async setCachedAlbums(albums) {
    try {
      const data = {
        albums,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem('band_albums', JSON.stringify(data));
    } catch (error) {
      console.warn('앨범 캐시 저장 실패:', error);
    }
  }

  static async getCachedPhotos(albumId) {
    try {
      const cached = await AsyncStorage.getItem(`photos_${albumId}`);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > this.CACHE_DURATION) {
        return null;
      }
      
      return data.photos;
    } catch (error) {
      console.warn('사진 캐시 읽기 실패:', error);
      return null;
    }
  }

  static async setCachedPhotos(albumId, photos) {
    try {
      const data = {
        photos,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(
        `photos_${albumId}`, 
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn('사진 캐시 저장 실패:', error);
    }
  }

  static async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith('band_albums') || key.startsWith('photos_')
      );
      
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('캐시 삭제 실패:', error);
    }
  }
}

export default PhotoCache;
```

## 📱 UI 컴포넌트 구조

### 1. 메인 사진첩 화면
```jsx
// src/screens/main/PhotosScreen.js
const PhotosScreen = ({ navigation }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      
      // 캐시에서 먼저 로드
      const cachedAlbums = await PhotoCache.getCachedAlbums();
      if (cachedAlbums) {
        setAlbums(cachedAlbums);
        setLoading(false);
      }
      
      // Band API에서 최신 데이터 가져오기
      const freshAlbums = await bandPhotoAPI.getAlbums(
        BAND_CONFIG.TARGET_BAND_KEY
      );
      
      setAlbums(freshAlbums);
      await PhotoCache.setCachedAlbums(freshAlbums);
      
      setSyncStatus({
        success: true,
        lastSync: new Date(),
        message: '동기화 완료'
      });
      
    } catch (error) {
      console.error('앨범 로드 실패:', error);
      setSyncStatus({
        success: false,
        lastSync: new Date(),
        message: error.message
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAlbums();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>사진첩</Text>
        <IconButton
          icon="refresh"
          onPress={onRefresh}
          disabled={loading}
        />
      </View>

      {/* 동기화 상태 */}
      <SyncStatusCard status={syncStatus} />

      {/* 앨범 그리드 */}
      <FlatList
        data={albums}
        numColumns={2}
        renderItem={({ item }) => (
          <AlbumCard 
            album={item}
            onPress={() => navigation.navigate('AlbumDetail', { 
              albumId: item.id,
              albumName: item.name 
            })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.albumGrid}
      />
    </SafeAreaView>
  );
};
```

### 2. 동기화 상태 카드
```jsx
// src/components/photo/SyncStatusCard.js
const SyncStatusCard = ({ status }) => {
  if (!status) return null;

  return (
    <Card style={[
      styles.statusCard,
      status.success ? styles.successCard : styles.errorCard
    ]}>
      <Card.Content>
        <View style={styles.statusContent}>
          <Icon 
            name={status.success ? "check-circle" : "alert-circle"}
            size={20}
            color={status.success ? theme.colors.success : theme.colors.error}
          />
          <Text style={styles.statusText}>{status.message}</Text>
          <Text style={styles.syncTime}>
            {formatRelativeTime(status.lastSync)}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};
```

### 3. 앨범 카드
```jsx
// src/components/photo/AlbumCard.js
const AlbumCard = ({ album, onPress }) => {
  return (
    <Surface style={styles.albumCard} elevation={2}>
      <TouchableRipple onPress={onPress}>
        <View>
          {/* 앨범 커버 이미지 */}
          <View style={styles.coverContainer}>
            {album.coverPhoto ? (
              <Image 
                source={{ uri: album.coverPhoto.thumbnailUrl }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.emptyCover}>
                <Icon name="image" size={40} color={theme.colors.outline} />
              </View>
            )}
            
            {/* 사진 수 오버레이 */}
            <View style={styles.photoCountOverlay}>
              <Text style={styles.photoCount}>
                {album.photoCount}장
              </Text>
            </View>
          </View>
          
          {/* 앨범 정보 */}
          <View style={styles.albumInfo}>
            <Text style={styles.albumName} numberOfLines={2}>
              {album.name}
            </Text>
            <Text style={styles.updateDate}>
              {formatRelativeTime(album.updatedAt)}
            </Text>
          </View>
        </View>
      </TouchableRipple>
    </Surface>
  );
};
```

### 4. 앨범 상세 화면
```jsx
// src/screens/detail/AlbumDetailScreen.js
const AlbumDetailScreen = ({ route, navigation }) => {
  const { albumId, albumName } = route.params;
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    navigation.setOptions({ title: albumName });
    loadPhotos();
  }, [albumId]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      
      // 캐시에서 먼저 로드
      const cachedPhotos = await PhotoCache.getCachedPhotos(albumId);
      if (cachedPhotos) {
        setPhotos(cachedPhotos);
        setLoading(false);
      }
      
      // Band API에서 최신 사진 가져오기
      const freshPhotos = await bandPhotoAPI.getPhotos(
        BAND_CONFIG.TARGET_BAND_KEY,
        albumId
      );
      
      setPhotos(freshPhotos);
      await PhotoCache.setCachedPhotos(albumId, freshPhotos);
      
    } catch (error) {
      console.error('사진 로드 실패:', error);
      Alert.alert('오류', '사진을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openPhotoViewer = (index) => {
    navigation.navigate('PhotoViewer', {
      photos,
      initialIndex: index
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 툴바 */}
      <View style={styles.toolbar}>
        <Text style={styles.photoCount}>
          총 {photos.length}장
        </Text>
        
        <View style={styles.viewModeToggle}>
          <IconButton
            icon="grid"
            selected={viewMode === 'grid'}
            onPress={() => setViewMode('grid')}
          />
          <IconButton
            icon="view-list"
            selected={viewMode === 'list'}
            onPress={() => setViewMode('list')}
          />
        </View>
      </View>

      {/* 사진 그리드/리스트 */}
      {viewMode === 'grid' ? (
        <PhotoGrid 
          photos={photos}
          onPhotoPress={openPhotoViewer}
        />
      ) : (
        <PhotoList 
          photos={photos}
          onPhotoPress={openPhotoViewer}
        />
      )}
    </SafeAreaView>
  );
};
```

### 5. 사진 그리드
```jsx
// src/components/photo/PhotoGrid.js
const PhotoGrid = ({ photos, onPhotoPress }) => {
  const renderPhoto = ({ item, index }) => (
    <PhotoGridItem 
      photo={item}
      onPress={() => onPhotoPress(index)}
    />
  );

  return (
    <FlatList
      data={photos}
      numColumns={3}
      renderItem={renderPhoto}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.grid}
    />
  );
};

const PhotoGridItem = ({ photo, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={onPress}
    >
      <Image 
        source={{ uri: photo.thumbnailUrl }}
        style={styles.gridImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
};
```

### 6. 사진 뷰어
```jsx
// src/screens/detail/PhotoViewerScreen.js
const PhotoViewerScreen = ({ route, navigation }) => {
  const { photos, initialIndex = 0 } = route.params;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isVisible, setIsVisible] = useState(true);

  const currentPhoto = photos[currentIndex];

  const downloadPhoto = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진을 저장하려면 갤러리 접근 권한이 필요합니다.');
        return;
      }

      const response = await FileSystem.downloadAsync(
        currentPhoto.url,
        FileSystem.documentDirectory + `photo_${currentPhoto.id}.jpg`
      );

      const asset = await MediaLibrary.createAssetAsync(response.uri);
      await MediaLibrary.createAlbumAsync('동배즐', asset, false);
      
      Alert.alert('완료', '사진이 갤러리에 저장되었습니다.');
    } catch (error) {
      Alert.alert('오류', '사진 저장에 실패했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      {/* 이미지 뷰어 */}
      <PagerView
        style={styles.pager}
        initialPage={initialIndex}
        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
      >
        {photos.map((photo, index) => (
          <PhotoViewerItem 
            key={photo.id}
            photo={photo}
            onToggleUI={() => setIsVisible(!isVisible)}
          />
        ))}
      </PagerView>

      {/* UI 오버레이 */}
      {isVisible && (
        <>
          {/* 상단 바 */}
          <View style={styles.topBar}>
            <IconButton
              icon="close"
              iconColor="white"
              onPress={() => navigation.goBack()}
            />
            
            <Text style={styles.counter}>
              {currentIndex + 1} / {photos.length}
            </Text>
            
            <IconButton
              icon="download"
              iconColor="white"
              onPress={downloadPhoto}
            />
          </View>

          {/* 하단 정보 */}
          <View style={styles.bottomBar}>
            <PhotoInfo photo={currentPhoto} />
          </View>
        </>
      )}
    </View>
  );
};
```

### 7. 사진 뷰어 아이템
```jsx
// src/components/photo/PhotoViewerItem.js
const PhotoViewerItem = ({ photo, onToggleUI }) => {
  return (
    <TouchableWithoutFeedback onPress={onToggleUI}>
      <View style={styles.photoContainer}>
        <ImageZoom
          cropWidth={Dimensions.get('window').width}
          cropHeight={Dimensions.get('window').height}
          imageWidth={photo.width}
          imageHeight={photo.height}
        >
          <Image 
            source={{ uri: photo.url }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </ImageZoom>
      </View>
    </TouchableWithoutFeedback>
  );
};
```

## 🔄 오프라인 지원

### 1. 오프라인 상태 관리
```javascript
// src/hooks/useOfflinePhotos.js
const useOfflinePhotos = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [cachedAlbums, setCachedAlbums] = useState([]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      
      if (!state.isConnected) {
        loadOfflineData();
      }
    });

    return unsubscribe;
  }, []);

  const loadOfflineData = async () => {
    try {
      const albums = await PhotoCache.getCachedAlbums();
      if (albums) {
        setCachedAlbums(albums);
      }
    } catch (error) {
      console.warn('오프라인 데이터 로드 실패:', error);
    }
  };

  return {
    isOnline,
    cachedAlbums,
    hasOfflineData: cachedAlbums.length > 0
  };
};
```

### 2. 오프라인 알림
```jsx
// src/components/photo/OfflineNotice.js
const OfflineNotice = ({ isOnline, hasOfflineData }) => {
  if (isOnline) return null;

  return (
    <Surface style={styles.offlineNotice} elevation={2}>
      <Icon name="wifi-off" size={20} color={theme.colors.warning} />
      <Text style={styles.offlineText}>
        {hasOfflineData 
          ? '오프라인 모드 - 캐시된 사진을 표시합니다'
          : '인터넷 연결을 확인해주세요'
        }
      </Text>
    </Surface>
  );
};
```

## 📊 상태 관리

### Photo Context
```javascript
// src/context/PhotoContext.js
const PhotoContext = createContext();

export const PhotoProvider = ({ children }) => {
  const [albums, setAlbums] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const syncWithBand = async () => {
    try {
      setLoading(true);
      setSyncStatus({ type: 'syncing', message: '동기화 중...' });
      
      const freshAlbums = await bandPhotoAPI.getAlbums(
        BAND_CONFIG.TARGET_BAND_KEY
      );
      
      setAlbums(freshAlbums);
      await PhotoCache.setCachedAlbums(freshAlbums);
      
      setSyncStatus({ 
        type: 'success', 
        message: '동기화 완료',
        timestamp: new Date()
      });
      
    } catch (error) {
      setSyncStatus({ 
        type: 'error', 
        message: error.message,
        timestamp: new Date()
      });
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    await PhotoCache.clearCache();
    setAlbums([]);
    setSyncStatus(null);
  };

  return (
    <PhotoContext.Provider value={{
      albums,
      syncStatus,
      loading,
      syncWithBand,
      clearCache
    }}>
      {children}
    </PhotoContext.Provider>
  );
};
```

## 🎨 스타일링

### 사진첩 테마
```javascript
const photoTheme = {
  colors: {
    background: '#000000',
    surface: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.7)',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336'
  },
  
  grid: {
    itemSize: (screenWidth - 32) / 3 - 4,
    spacing: 2
  },
  
  viewer: {
    backgroundColor: '#000000',
    overlayHeight: 60
  }
};
```

이 설계를 통해 Naver Band와 완전히 연동된 사진첩 시스템을 구현할 수 있으며, 오프라인 지원과 캐싱을 통해 원활한 사용자 경험을 제공할 수 있습니다.