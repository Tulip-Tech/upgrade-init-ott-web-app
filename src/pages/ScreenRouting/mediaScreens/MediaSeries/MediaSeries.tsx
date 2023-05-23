import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import shallow from 'zustand/shallow';
import { useSearchParams } from 'react-router-dom';

import { filterSeries, getEpisodesInSeason, getFiltersFromSeries } from './utils';

import { generateEpisodeJSONLD } from '#src/utils/structuredData';
import VideoLayout from '#components/VideoLayout/VideoLayout';
import InlinePlayer from '#src/containers/InlinePlayer/InlinePlayer';
import { isLocked } from '#src/utils/entitlements';
import useEntitlement from '#src/hooks/useEntitlement';
import { deprecatedSeriesURL, formatSeriesMetaString, formatVideoMetaString, mediaURL } from '#src/utils/formatting';
import useMedia from '#src/hooks/useMedia';
import { useSeriesData } from '#src/hooks/series/useSeriesData';
import { useEpisodes } from '#src/hooks/series/useEpisodes';
import { useEpisodeMetadata } from '#src/hooks/series/useEpisodeMetadata';
import { useNextEpisode } from '#src/hooks/series/useNextEpisode';
import ErrorPage from '#components/ErrorPage/ErrorPage';
import { useWatchHistoryStore } from '#src/stores/WatchHistoryStore';
import { useConfigStore } from '#src/stores/ConfigStore';
import { useAccountStore } from '#src/stores/AccountStore';
import StartWatchingButton from '#src/containers/StartWatchingButton/StartWatchingButton';
import useBreakpoint, { Breakpoint } from '#src/hooks/useBreakpoint';
import Cinema from '#src/containers/Cinema/Cinema';
import TrailerModal from '#src/containers/TrailerModal/TrailerModal';
import ShareButton from '#components/ShareButton/ShareButton';
import FavoriteButton from '#src/containers/FavoriteButton/FavoriteButton';
import Button from '#components/Button/Button';
import PlayTrailer from '#src/icons/PlayTrailer';
import type { PlaylistItem } from '#types/playlist';
import Loading from '#src/pages/Loading/Loading';
import type { ScreenComponent } from '#types/screens';
import useQueryParam from '#src/hooks/useQueryParam';
import { getSeriesPlaylistIdFromCustomParams } from '#src/utils/media';
import { VideoProgressMinMax } from '#src/config';

const MediaSeriesContent: ScreenComponent<PlaylistItem> = ({ data: seriesMedia }) => {
  const breakpoint = useBreakpoint();
  const { t } = useTranslation('video');
  const [playTrailer, setPlayTrailer] = useState<boolean>(false);

  // Navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const seriesId = seriesMedia.mediaid;
  const play = searchParams.get('play') === '1';
  const feedId = searchParams.get('r');
  const episodeId = searchParams.get('e');

  // Main data
  const { isLoading: isSeriesDataLoading, data } = useSeriesData(seriesId, seriesId);
  const { series, playlist: seriesPlaylist } = data || {};
  const { isLoading: isEpisodeLoading, data: episode } = useMedia(episodeId || '');
  const { isLoading: isTrailerLoading, data: trailerItem } = useMedia(episode?.trailerId || '');
  const { data: episodeMetadata, isLoading: isEpisodeMetadataLoading } = useEpisodeMetadata(episode, series, { enabled: !!episode && !!series });

  // Whether we show series or episode information
  const selectedItem = (episode || seriesMedia) as PlaylistItem;

  // Config
  const { config, accessModel } = useConfigStore(({ config, accessModel }) => ({ config, accessModel }), shallow);
  const { features, siteName, custom } = config;
  const isFavoritesEnabled: boolean = Boolean(features?.favoritesList);
  const inlineLayout = Boolean(custom?.inlinePlayer);

  // Filters
  const filters = useMemo(() => getFiltersFromSeries(series), [series]);
  const [seasonFilter, setSeasonFilter] = useState<string | undefined>(undefined);

  // Season / episodes data
  const {
    data: episodes,
    fetchNextPage: fetchNextEpisodes,
    hasNextPage: hasNextEpisodesPage,
  } = useEpisodes(seriesId, seasonFilter, { enabled: seasonFilter !== undefined && !!series });

  const firstEpisode = useMemo(() => episodes?.[0]?.episodes?.[0], [episodes]);
  const filteredPlaylist = useMemo(() => filterSeries(seriesPlaylist, episodes), [seriesPlaylist, episodes]);
  const episodesInSeason = getEpisodesInSeason(episodeMetadata, series);
  const nextItem = useNextEpisode({ episode, seriesPlaylist, series, episodeMetadata });

  // Watch history
  const watchHistoryArray = useWatchHistoryStore((state) => state.watchHistory);
  const watchHistoryDictionary = useWatchHistoryStore((state) => state.getDictionaryWithEpisodes());
  const episodeInProgress = watchHistoryArray.find(
    (episode) => episode?.seriesId === seriesId && episode.progress > VideoProgressMinMax.Min && episode.progress < VideoProgressMinMax.Max,
  );

  // User, entitlement
  const { user, subscription } = useAccountStore(({ user, subscription }) => ({ user, subscription }), shallow);
  const { isEntitled } = useEntitlement(episode);
  const isLoggedIn = !!user;
  const hasSubscription = !!subscription;

  // Handlers
  const goBack = useCallback(() => {
    setSearchParams({ ...searchParams, e: episode?.mediaid, r: feedId || '' });
  }, [setSearchParams, searchParams, episode, feedId]);

  const onCardClick = useCallback(
    (toEpisode: PlaylistItem) => {
      setSearchParams({ ...searchParams, e: toEpisode.mediaid });
    },
    [setSearchParams, searchParams],
  );

  const handleComplete = useCallback(async () => {
    setSearchParams({ ...searchParams, e: (nextItem || episode)?.mediaid, r: feedId || '', play: nextItem ? '1' : '0' });
  }, [setSearchParams, nextItem, episode, feedId, searchParams]);

  // Effects
  useEffect(() => {
    (document.scrollingElement || document.body).scroll({ top: 0 });
  }, [episode]);

  useEffect(() => {
    if (episodeInProgress && !searchParams.get('e')) {
      setSearchParams({ ...searchParams, e: episodeInProgress.mediaid, r: feedId || '' }, { replace: true });
    }
  }, [episodeInProgress, setSearchParams, searchParams, feedId]);

  useEffect(() => {
    if (isSeriesDataLoading || isEpisodeLoading || isEpisodeMetadataLoading) {
      return;
    }

    if (!episodeId) {
      // No episode is selected
      setSeasonFilter(filters[0] || '');
      return;
    }

    // Select a corresponding season for an episode
    if (seasonFilter === undefined && episodeMetadata) {
      setSeasonFilter(episodeMetadata.seasonNumber);
    }
  }, [episodeMetadata, seasonFilter, isSeriesDataLoading, isEpisodeLoading, isEpisodeMetadataLoading, filters, episodeId]);

  // UI
  const isLoading = isSeriesDataLoading || isEpisodeMetadataLoading || isEpisodeLoading;
  if (isLoading) return <Loading />;
  if (!series || !seriesMedia) return <ErrorPage title={t('series_error')} />;

  const pageTitle = `${selectedItem.title} - ${siteName}`;
  const canonicalUrl = `${window.location.origin}${mediaURL({ media: seriesMedia, episodeId: episode?.mediaid })}`;

  const primaryMetadata = formatVideoMetaString(
    selectedItem,
    t('video:total_episodes', { count: series ? series.episode_count : seriesPlaylist.playlist.length }),
  );
  const secondaryMetadata = episodeMetadata && episode && (
    <>
      <strong>{formatSeriesMetaString(episodeMetadata.seasonNumber, episodeMetadata.episodeNumber)}</strong> - {episode.title}
    </>
  );
  const filterMetadata =
    episodeMetadata &&
    ` ${t('video:season')} ${episodeMetadata.seasonNumber}/${filters?.length} - ${t('video:episode')} ${episodeMetadata.episodeNumber}/${episodesInSeason}`;
  const shareButton = <ShareButton title={selectedItem?.title} description={selectedItem.description} url={canonicalUrl} />;
  const startWatchingButton = (
    <StartWatchingButton
      item={episode || firstEpisode}
      onClick={() => {
        setSearchParams({ ...searchParams, e: (episode || firstEpisode).mediaid, r: feedId || '', play: '1' }, { replace: true });
      }}
    />
  );

  // For the old series approach we mark episodes as favorite items. New approach is applied to the series
  const favoriteButton = isFavoritesEnabled && <FavoriteButton item={seriesMedia || firstEpisode} />;
  const trailerButton = (!!trailerItem || isTrailerLoading) && (
    <Button
      label={t('video:trailer')}
      aria-label={t('video:watch_trailer')}
      startIcon={<PlayTrailer />}
      onClick={() => setPlayTrailer(true)}
      active={playTrailer}
      fullWidth={breakpoint < Breakpoint.md}
      disabled={!trailerItem}
    />
  );

  return (
    <React.Fragment>
      <Helmet>
        <title>{pageTitle}</title>
        <link rel="canonical" href={canonicalUrl} />
        <meta name="description" content={selectedItem.description} />
        <meta property="og:description" content={selectedItem.description} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:type" content={episode ? 'video.episode' : 'video.series'} />
        {selectedItem.image && <meta property="og:image" content={selectedItem.image?.replace(/^https:/, 'http:')} />}
        {selectedItem.image && <meta property="og:image:secure_url" content={selectedItem.image?.replace(/^http:/, 'https:')} />}
        {selectedItem.image && <meta property="og:image:width" content={selectedItem.image ? '720' : ''} />}
        {selectedItem.image && <meta property="og:image:height" content={selectedItem.image ? '406' : ''} />}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={selectedItem.description} />
        <meta name="twitter:image" content={selectedItem.image} />
        <meta property="og:video" content={canonicalUrl.replace(/^https:/, 'http:')} />
        <meta property="og:video:secure_url" content={canonicalUrl.replace(/^http:/, 'https:')} />
        <meta property="og:video:type" content="text/html" />
        <meta property="og:video:width" content="1280" />
        <meta property="og:video:height" content="720" />
        {selectedItem.tags?.split(',').map((tag: string) => (
          <meta property="og:video:tag" content={tag} key={tag} />
        ))}
        {seriesPlaylist && selectedItem ? (
          <script type="application/ld+json">{generateEpisodeJSONLD(series, seriesMedia, episode, episodeMetadata)}</script>
        ) : null}
      </Helmet>
      <VideoLayout
        item={selectedItem}
        title={inlineLayout ? selectedItem.title : seriesPlaylist.title}
        description={selectedItem.description}
        inlineLayout={inlineLayout}
        primaryMetadata={primaryMetadata}
        secondaryMetadata={secondaryMetadata}
        image={selectedItem.backgroundImage}
        shareButton={shareButton}
        favoriteButton={favoriteButton}
        trailerButton={trailerButton}
        startWatchingButton={startWatchingButton}
        isLoading={isLoading}
        accessModel={accessModel}
        isLoggedIn={isLoggedIn}
        hasSubscription={hasSubscription}
        playlist={filteredPlaylist}
        relatedTitle={inlineLayout ? seriesPlaylist.title : t('episodes')}
        onItemClick={onCardClick}
        setFilter={setSeasonFilter}
        currentFilter={seasonFilter}
        filterValuePrefix={t('season_prefix')}
        defaultFilterLabel={t('all_seasons')}
        activeLabel={t('current_episode')}
        watchHistory={watchHistoryDictionary}
        filterMetadata={filterMetadata}
        filters={filters}
        hasLoadMore={hasNextEpisodesPage}
        loadMore={fetchNextEpisodes}
        player={
          inlineLayout && (episode || firstEpisode) ? (
            <InlinePlayer
              isLoggedIn={isLoggedIn}
              item={episode || firstEpisode}
              onComplete={handleComplete}
              feedId={feedId ?? undefined}
              startWatchingButton={startWatchingButton}
              paywall={isLocked(accessModel, isLoggedIn, hasSubscription, episode || firstEpisode)}
              autostart={play || undefined}
            />
          ) : (
            <Cinema
              open={play && isEntitled}
              onClose={goBack}
              item={episode || firstEpisode}
              title={seriesPlaylist.title}
              primaryMetadata={primaryMetadata}
              secondaryMetadata={secondaryMetadata}
              onComplete={handleComplete}
              feedId={feedId ?? undefined}
            />
          )
        }
      />
      {episode && <TrailerModal item={trailerItem} title={`${episode.title} - Trailer`} open={playTrailer} onClose={() => setPlayTrailer(false)} />}
    </React.Fragment>
  );
};

/**
 * This wrapper is used to check which series flow is used
 * If only new flow with series api is used, it can be deleted and replaced by MediaSeriesContent
 */
const MediaSeries: ScreenComponent<PlaylistItem> = ({ data: media, isLoading: isMediaLoading }) => {
  const { t } = useTranslation('video');
  const play = useQueryParam('play') === '1';
  const feedId = useQueryParam('r');

  const mediaId = media.mediaid;

  const legacySeriesPlaylistId = getSeriesPlaylistIdFromCustomParams(media) || '';
  const { isLoading: isSeriesLoading, isPlaylistError, data } = useSeriesData(legacySeriesPlaylistId, mediaId);
  const { playlist: seriesPlaylist, series } = data || {};

  if (isSeriesLoading || isMediaLoading) {
    return <Loading />;
  }

  if (isPlaylistError || !seriesPlaylist) {
    return <ErrorPage title={t('series_error')} />;
  }

  // No series data means that old flow is used
  if (!series) {
    return <Navigate to={deprecatedSeriesURL({ seriesId: legacySeriesPlaylistId, play, playlistId: feedId })} replace />;
  }

  return <MediaSeriesContent data={media} isLoading={isSeriesLoading || isMediaLoading} />;
};

export default MediaSeries;
