import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { router } from 'expo-router'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { Sentry } from '@/lib/sentry'
import { OFFICIAL_DUTCH_A1_PACK_SIZE } from '@/services/starterPackService'
import { officialContentCatalogService } from '@/services/officialContentCatalogService'

const openBundledPack = () => router.push(ROUTES.STARTER_PACK)

const openRemotePack = (item: OfficialContentCatalogItem) =>
  router.push({
    pathname: ROUTES.STARTER_PACK,
    params: { packId: item.packId, version: item.version },
  })

export function OfficialContentCatalogScreen() {
  const colorScheme = useNormalizedColorScheme()
  const [catalog, setCatalog] = useState<OfficialContentCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCatalog(await officialContentCatalogService.getCatalog())
    } catch (loadError) {
      Sentry.captureException(loadError, {
        tags: { operation: 'loadOfficialContentCatalog' },
      })
      setError(
        'The online catalog is unavailable. The offline pack still works.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void officialContentCatalogService
      .getCatalog()
      .then(items => {
        if (active) setCatalog(items)
      })
      .catch(loadError => {
        if (!active) return
        Sentry.captureException(loadError, {
          tags: { operation: 'loadOfficialContentCatalog' },
        })
        setError(
          'The online catalog is unavailable. The offline pack still works.'
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const cardColors = {
    backgroundColor:
      colorScheme === 'dark'
        ? Colors.dark.backgroundSecondary
        : Colors.background.secondary,
    borderColor:
      colorScheme === 'dark' ? Colors.dark.border : Colors.neutral[200],
  }

  return (
    <ViewThemed style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={catalog}
        keyExtractor={item => item.packId}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <TextThemed style={styles.introduction}>
              Download reviewed vocabulary packs when you need them. Updates do
              not require a new app version.
            </TextThemed>
            <Pressable
              accessibilityHint="Preview the bundled pack that works without a network connection"
              accessibilityLabel="Open Dutch A1 Essentials"
              accessibilityRole="button"
              onPress={openBundledPack}
              style={[styles.card, cardColors]}
            >
              <View style={styles.badgeRow}>
                <TextThemed style={styles.level}>A1</TextThemed>
                <TextThemed style={styles.offlineBadge}>OFFLINE</TextThemed>
              </View>
              <TextThemed style={styles.title}>Dutch A1 Essentials</TextThemed>
              <TextThemed style={styles.description}>
                {OFFICIAL_DUTCH_A1_PACK_SIZE} essential words included with the
                app.
              </TextThemed>
            </Pressable>
            {loading && (
              <View
                accessibilityLabel="Loading online official packs"
                style={styles.status}
              >
                <ActivityIndicator />
                <TextThemed>Loading online packs…</TextThemed>
              </View>
            )}
            {error && (
              <View style={styles.errorBox}>
                <TextThemed selectable style={styles.errorText}>
                  {error}
                </TextThemed>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadCatalog()}
                >
                  <TextThemed style={styles.retry}>Try again</TextThemed>
                </Pressable>
              </View>
            )}
            {!loading && !error && catalog.length > 0 && (
              <TextThemed style={styles.sectionTitle}>ONLINE PACKS</TextThemed>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityHint="Download, preview, and import this official pack"
            accessibilityLabel={`Open ${item.title}`}
            accessibilityRole="button"
            onPress={() => openRemotePack(item)}
            style={[styles.card, cardColors]}
          >
            <View style={styles.badgeRow}>
              <TextThemed style={styles.level}>{item.cefrLevel}</TextThemed>
              <TextThemed style={styles.version}>v{item.version}</TextThemed>
            </View>
            <TextThemed style={styles.title}>{item.title}</TextThemed>
            <TextThemed style={styles.description}>
              {item.description}
            </TextThemed>
            <TextThemed style={styles.entryCount}>
              {item.entryCount} words
            </TextThemed>
          </Pressable>
        )}
      />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 12, padding: 16, paddingBottom: 32 },
  headerContent: { gap: 16 },
  introduction: { fontSize: 15, lineHeight: 21 },
  card: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 16,
  },
  badgeRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  level: { color: Colors.primary.DEFAULT, fontSize: 13, fontWeight: '700' },
  offlineBadge: {
    color: Colors.success.DEFAULT,
    fontSize: 11,
    fontWeight: '700',
  },
  version: { fontSize: 12, opacity: 0.55 },
  title: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20, opacity: 0.7 },
  entryCount: { fontSize: 12, fontWeight: '600', opacity: 0.55 },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    padding: 16,
  },
  errorBox: { gap: 10, paddingVertical: 8 },
  errorText: { color: Colors.error.DEFAULT, fontSize: 14, lineHeight: 20 },
  retry: { color: Colors.primary.DEFAULT, fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '600', opacity: 0.55 },
})
