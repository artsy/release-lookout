export const github = async <T = unknown>(url: string, options?: RequestInit): Promise<T> => {
	const res = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ""}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"Content-Type": "application/json",
		},
	})
	if (!res.ok) {
		const body = await res.text()
		throw new Error(`GitHub API error ${res.status}: ${body}`)
	}
	return res.json() as Promise<T>
}
