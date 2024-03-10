import { defineCollection, z } from 'astro:content';

const projectsCollection = defineCollection({
	schema: z.object({
		inProgress: z.boolean(),
		title: z.string(),
		description: z.string(),
		skills: z.array(z.string()),
		link: z.string(),
		img_alt: z.string().optional(),
		img_url: z.string(),
	}),
});

export const collections = {
	projects: projectsCollection,
};
