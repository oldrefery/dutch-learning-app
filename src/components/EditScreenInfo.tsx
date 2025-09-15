import React from 'react'
import { StyleSheet } from 'react-native'

import { ExternalLink } from './ExternalLink'
import { MonoText } from './StyledText'
import { TextThemed, ViewThemed } from './Themed'

import { Colors } from '@/constants/Colors'

export default function EditScreenInfo({ path }: { path: string }) {
  return (
    <ViewThemed>
      <ViewThemed style={styles.getStartedContainer}>
        <TextThemed
          style={styles.getStartedText}
          lightColor={Colors.transparent.textLight}
          darkColor={Colors.transparent.textDark}
        >
          Open up the code for this screen:
        </TextThemed>

        <ViewThemed
          style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
          darkColor={Colors.transparent.backgroundDark}
          lightColor={Colors.transparent.backgroundLight}
        >
          <MonoText>{path}</MonoText>
        </ViewThemed>

        <TextThemed
          style={styles.getStartedText}
          lightColor={Colors.transparent.textLight}
          darkColor={Colors.transparent.textDark}
        >
          Change any of the text, save the file, and your app will automatically
          update.
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={styles.helpContainer}>
        <ExternalLink
          style={styles.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet"
        >
          <TextThemed
            style={styles.helpLinkText}
            lightColor={Colors.light.tint}
          >
            Tap here if your app doesn&apos;t automatically update after making
            changes
          </TextThemed>
        </ExternalLink>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: 50,
  },
  homeScreenFilename: {
    marginVertical: 7,
  },
  codeHighlightContainer: {
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  getStartedText: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: 15,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: 15,
  },
  helpLinkText: {
    textAlign: 'center',
  },
})
