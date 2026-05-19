import { useStoryProgress } from './useStoryProgress';

/**
 * Headless island: runs the scroll-progress hook and renders nothing.
 * Mounted once on `/` next to ScrollyController.
 */
export default function StoryProgress(): null {
  useStoryProgress();
  return null;
}
