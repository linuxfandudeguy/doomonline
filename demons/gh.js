    // Create the GitHub floating icon and its container
    const githubIconContainer = document.createElement('a');
    githubIconContainer.href = 'https://github.com/linuxfandudeguy/doomonline';
    githubIconContainer.target = '_blank';
    githubIconContainer.id = 'github-icon';

    // Create the img element for the GitHub logo
    const githubIcon = document.createElement('img');
    githubIcon.src = './demons/github-mark-white.svg';
    githubIcon.alt = 'GitHub';

    // Append the image to the link
    githubIconContainer.appendChild(githubIcon);

    // Append the link to the body
    document.body.appendChild(githubIconContainer);

    // Create and inject the CSS styles dynamically
    const style = document.createElement('style');
    style.innerHTML = `
      #github-icon {
        position: fixed;
        bottom: 20px; /* Position it in the bottom-left corner */
        left: 20px;
        z-index: 1000; /* Ensures it's on top of other content */
        background-color: #24292f; /* GitHub gray */
        border-radius: 50%; /* Makes it a circle */
        padding: 8px; /* Space around the icon */
        display: inline-block;
        transition: all 0.3s ease; /* Smooth transition for hover effect */
      }

      #github-icon img {
        width: 40px; /* Smaller size */
        height: auto;
        transition: transform 0.3s ease; /* Smooth transition for scaling */
      }

      #github-icon:hover img {
        transform: scale(1.15); /* Scale up by 15% */
      }
    `;
    document.head.appendChild(style);
