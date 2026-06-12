import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	configId: params.config || 'default'
});
