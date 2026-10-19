# Publishing on GitHub Pages

The repository includes a complete GitHub Actions workflow at
`.github/workflows/deploy-pages.yml`.

## First-time setup

1. Push the entire project to a GitHub repository using `main` as the default
   branch.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open **Actions → Deploy to GitHub Pages** and run the workflow, or push a
   commit to `main`.

The workflow installs the locked pnpm dependencies, builds the Vite app,
uploads `dist`, and deploys it through GitHub's official Pages action.

Both project URLs such as `https://owner.github.io/repository/` and root URLs
such as `https://owner.github.io/` are supported. Catalogue data, images, the
favicon, and application assets use repository-safe paths.

## Updating the live site

Push changes to `main`. A successful workflow run automatically replaces the
published site.

## Before publishing

Replace the marketplace homepage placeholders in `marketplaceProfiles` inside
`src/App.tsx` with the four real account profile URLs.
