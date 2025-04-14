# Contributing

Thank you for your interest in contributing to Shadboard! We're excited to have you join our open-source project and appreciate your willingness to help enhance it. Whether you're fixing bugs, adding new features, or improving documentation, every contribution makes a significant impact.

Before submitting your first pull request, please review this document to help ensure that your contributions align with the project's goals and guidelines. We also encourage you to check for open issues and pull requests to avoid duplication of work.

## How to Contribute

### 1. Fork the Repository

- Fork the Shadboard repository to your own GitHub account by clicking the "Fork" button at the top of the repository page.

### 2. Clone Your Fork

- After forking, clone the repository to your local machine:

  ```bash
  git clone https://github.com/your-username/shadboard.git
  ```

### 3. Navigate to project directory

```bash
cd full-kit
```

### 4. Create a new Branch

```bash
git checkout -b my-new-branch
```

### 5. Install dependencies

```bash
npm install
```

### 6. Run the development server locally

```bash
npm run dev
```

## Commit Convention

Before submitting a pull request, we kindly ask that you check whether your commits align with the conventions used in this repository. This helps maintain consistency and clarity in the commit history.

When creating a commit, please follow the convention of using the format `category(scope or module): message` for your commit messages. Below are the categories to choose from:

- **feat / feature**: Changes that introduce new code or new features.
- **fix**: Changes that fix a bug (ideally referencing an issue if present).
- **refactor**: Code changes that neither fix a bug nor add a feature.
- **docs**: Changes to documentation, such as updates to the README or usage instructions.
- **build**: Changes related to the build process or the addition/removal of dependencies.
- **test**: Changes related to tests, such as adding or modifying tests.
- **ci**: Changes to continuous integration configuration (e.g., GitHub Actions, CI systems).
- **chore**: Miscellaneous changes that don't fit into any of the categories above.

### Example Commit Message:

```
feat(components): add new prop to the avatar component
```

If you'd like more details on the convention, you can visit [Conventional Commits](https://www.conventionalcommits.org/) or refer to the [Angular Commit Message Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit-message-guidelines).

We appreciate your cooperation in helping us keep the project's commit history clean and easy to follow!
