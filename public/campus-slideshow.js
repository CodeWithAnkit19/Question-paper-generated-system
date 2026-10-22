
/* PaperForge Campus Slideshow */

const campusMedia = [
  { type: "image", src: "campus%20photo1.jpeg" },
  { type: "image", src: "campus%20photo2.jpeg" },
  { type: "image", src: "campus%20photo3.jpg" },
  { type: "video", src: "campus%20video.mp4" }
];

let currentMediaIndex = 0;
let slideshowTimer = null;

const campusPhoto = document.getElementById("campusPhoto");
const campusVideo = document.getElementById("campusVideo");
const photoDots = Array.from(document.querySelectorAll(".photo-dot"));

function showCampusMedia(index) {
  if (!campusPhoto || !campusVideo) {
    console.error("Campus slideshow elements not found.");
    return;
  }

  clearTimeout(slideshowTimer);
  currentMediaIndex = index;

  const media = campusMedia[index];

  photoDots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });

  if (media.type === "image") {
    campusVideo.pause();
    campusVideo.removeAttribute("src");
    campusVideo.load();
    campusVideo.hidden = true;

    campusPhoto.hidden = false;
    campusPhoto.onerror = () => {
      console.error("Campus image could not load:", media.src);
    };

    campusPhoto.src = media.src;

    slideshowTimer = setTimeout(() => {
      showCampusMedia((currentMediaIndex + 1) % campusMedia.length);
    }, 5000);
  } else {
    campusPhoto.hidden = true;
    campusVideo.hidden = false;
    campusVideo.src = media.src;
    campusVideo.currentTime = 0;

    campusVideo.onended = () => {
      showCampusMedia((currentMediaIndex + 1) % campusMedia.length);
    };

    campusVideo.onerror = () => {
      console.error("Campus video could not load:", media.src);
      showCampusMedia((currentMediaIndex + 1) % campusMedia.length);
    };

    campusVideo.play().catch(error => {
      console.error("Campus video playback failed:", error);
      slideshowTimer = setTimeout(() => {
        showCampusMedia((currentMediaIndex + 1) % campusMedia.length);
      }, 10000);
    });
  }
}

showCampusMedia(0);
