import { PostizAPI } from '../api';
import { getConfig } from '../config';
import { readFileSync, existsSync } from 'fs';
import { exit } from 'node:process';

interface CommandArgs extends Record<string, unknown> {
  id?: string;
  releaseId?: string;
  json?: string;
  integrations?: string;
  content?: string | string[];
  media?: string | string[];
  delay?: number;
  type?: string;
  date?: string;
  shortLink?: boolean;
  settings?: string | Record<string, unknown>;
  startDate?: string;
  endDate?: string;
  customer?: string;
  status?: string;
}

export async function getMissingContent(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  if (!args.id) {
    console.error('❌ Post ID is required');
    exit(1);
  }

  try {
    const result = await api.getMissingContent(args.id as string);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to get missing content:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function connectPost(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  if (!args.id) {
    console.error('❌ Post ID is required');
    exit(1);
  }

  if (!args.releaseId) {
    console.error('❌ --release-id is required');
    exit(1);
  }

  try {
    const result = await api.updateReleaseId(args.id as string, args.releaseId as string);
    console.log(`✅ Post ${args.id} connected to release ${args.releaseId}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to connect post:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function createPost(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  // Support both simple and complex post creation
  let postData: Record<string, unknown>;

  if (args.json) {
    // Load from JSON file for complex posts with comments and media
    try {
      const jsonPath = args.json as string;
      if (!existsSync(jsonPath)) {
        console.error(`❌ JSON file not found: ${jsonPath}`);
        exit(1);
      }
      const jsonContent = readFileSync(jsonPath, 'utf-8');
      postData = JSON.parse(jsonContent);
    } catch (error) {
      console.error('❌ Failed to parse JSON file:', error instanceof Error ? error.message : String(error));
      exit(1);
    }
  } else {
    const integrations = args.integrations
      ? (args.integrations as string).split(',').map((id: string) => id.trim())
      : [];

    if (integrations.length === 0) {
      console.error('❌ At least one integration ID is required');
      console.error('Use -i or --integrations to specify integration IDs');
      console.error('Run "postiz integrations:list" to see available integrations');
      exit(1);
    }

    // Support multiple -c and -m flags
    // Normalize to arrays
    const contents = Array.isArray(args.content) ? args.content : [args.content as string];
    const medias = Array.isArray(args.media) ? args.media : (args.media ? [args.media as string] : []);

    if (!contents[0]) {
      console.error('❌ At least one -c/--content is required');
      exit(1);
    }

    // Build value array by pairing contents with their media
    const values = contents.map((content: string, index: number) => {
      const mediaForThisContent = medias[index] as string | undefined;
      const images = mediaForThisContent
        ? mediaForThisContent.split(',').map((img: string) => ({
            id: Math.random().toString(36).substring(7),
            path: img.trim(),
          }))
        : [];

      return {
        content: content,
        image: images,
        delay: args?.delay || 0,
      };
    });

    // Parse provider-specific settings if provided
    // Note: __type is automatically added by the backend based on integration ID
    let settings: Record<string, unknown> | undefined;

    if (args.settings) {
      try {
        settings = typeof args.settings === 'string'
          ? JSON.parse(args.settings)
          : (args.settings as Record<string, unknown>);
      } catch (error) {
        console.error('❌ Failed to parse settings JSON:', error instanceof Error ? error.message : String(error));
        exit(1);
      }
    }

    // Build the proper post structure
    postData = {
      type: args.type || 'schedule', // 'schedule' or 'draft'
      creationMethod: 'CLI',
      date: args.date, // Required date field
      shortLink: args.shortLink !== false,
      tags: [],
      posts: integrations.map((integrationId: string) => ({
        integration: { id: integrationId },
        value: values,
        settings: settings,
      })),
    };
  }

  try {
    const result = await api.createPost(postData);
    console.log('✅ Post created successfully!');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to create post:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function listPosts(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  // Set default date range: last 30 days to 30 days in the future
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);

  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 30);

  // Only send fields that are in GetPostsDto
  const filters: Record<string, string> = {
    startDate: (args.startDate as string) || defaultStartDate.toISOString(),
    endDate: (args.endDate as string) || defaultEndDate.toISOString(),
  };

  // customer is optional in the DTO
  if (args.customer) {
    filters.customer = args.customer as string;
  }

  try {
    const result = await api.listPosts(filters);
    console.log('📋 Posts:');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to list posts:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function changePostStatus(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  if (!args.id) {
    console.error('❌ Post ID is required');
    exit(1);
  }

  if (args.status !== 'draft' && args.status !== 'schedule') {
    console.error('❌ --status must be either "draft" or "schedule"');
    exit(1);
  }

  try {
    const result = await api.changePostStatus(args.id as string, args.status as 'draft' | 'schedule');
    console.log(`✅ Post ${args.id} status changed to ${args.status}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Failed to change post status:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

export async function deletePost(args: CommandArgs) {
  const config = getConfig();
  const api = new PostizAPI(config);

  if (!args.id) {
    console.error('❌ Post ID is required');
    exit(1);
  }

  try {
    await api.deletePost(args.id as string);
    console.log(`✅ Post ${args.id} deleted successfully!`);
  } catch (error) {
    console.error('❌ Failed to delete post:', error instanceof Error ? error.message : String(error));
    exit(1);
  }
}
